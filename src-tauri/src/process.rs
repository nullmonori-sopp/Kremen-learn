use serde_json::{json, Value};
use std::{
    collections::BTreeMap,
    io::{Read, Write},
    path::{Component, Path, PathBuf},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc,
    },
    thread,
    time::{Duration, Instant},
};

#[derive(Clone, Default)]
pub struct Control {
    pub cancel: Arc<AtomicBool>,
}
impl Control {
    pub fn stop(&self) {
        self.cancel.store(true, Ordering::SeqCst);
    }
    pub fn reset(&self) {
        self.cancel.store(false, Ordering::SeqCst);
    }
}

pub struct Output {
    pub stdout: String,
    pub stderr: String,
    pub code: i32,
    pub duration_ms: u128,
    pub reason: Option<String>,
}
impl Output {
    pub fn json(&self) -> Value {
        json!({"stdout":self.stdout,"stderr":self.stderr,"exitCode":self.code,"durationMs":self.duration_ms,"message":self.reason})
    }
}

pub fn safe_relative(path: &str) -> Result<PathBuf, String> {
    let p = Path::new(path);
    if path.is_empty()
        || path.contains('\\')
        || path.contains(':')
        || !p.components().all(|c| matches!(c, Component::Normal(_)))
    {
        return Err(format!("Invalid relative project path: {path}"));
    }
    Ok(p.to_path_buf())
}

pub fn write_files(root: &Path, files: &BTreeMap<String, String>) -> Result<(), String> {
    if files.is_empty() || files.len() > 128 {
        return Err("A project requires 1–128 source files".into());
    }
    let mut total = 0;
    for (name, text) in files {
        let relative = safe_relative(name)?;
        if !matches!(
            relative.extension().and_then(|s| s.to_str()),
            Some("kr" | "krh")
        ) {
            return Err("Only .kr and .krh project sources are accepted".into());
        }
        total += text.len();
        if total > 4 * 1024 * 1024 {
            return Err("Project source exceeds 4 MiB".into());
        }
        let path = root.join(relative);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        std::fs::write(path, text).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Run only after the namespace has exited: no untrusted writer remains.
/// Inspect every path component before reading a generated file on the host.
pub fn read_workspace_file(root: &Path, relative: &str, cap: u64) -> Result<String, String> {
    let relative = safe_relative(relative)?;
    let mut path = root.to_path_buf();
    for part in relative.components() {
        path.push(part.as_os_str());
        let info = std::fs::symlink_metadata(&path).map_err(|e| e.to_string())?;
        if info.file_type().is_symlink() {
            return Err("Generated file path contains a symbolic link".into());
        }
    }
    let info = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    if !info.is_file() || info.len() > cap {
        return Err("Generated file is not a bounded regular file".into());
    }
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

fn bounded_reader(
    mut stream: impl Read + Send + 'static,
    total: Arc<AtomicUsize>,
    cap: usize,
) -> thread::JoinHandle<Vec<u8>> {
    thread::spawn(move || {
        let mut result = Vec::new();
        let mut buffer = [0; 4096];
        loop {
            match stream.read(&mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let previous = total.fetch_add(n, Ordering::SeqCst);
                    let keep = cap.saturating_sub(previous).min(n);
                    result.extend_from_slice(&buffer[..keep]);
                }
            }
        }
        result
    })
}

/// Every invocation gets a private PID/mount/user/network namespace. Only the
/// staged workspace is writable. No host home, sockets, or device tree is bound.
#[cfg(target_os = "linux")]
pub fn run(
    toolchain: &Path,
    work: &Path,
    program: &str,
    args: &[String],
    stdin: &str,
    compile: bool,
    control: &Control,
    time_ms: u64,
    cap: usize,
) -> Result<Output, String> {
    use std::os::unix::{fs::MetadataExt, io::AsRawFd, net::UnixStream, process::CommandExt};
    // Adopt the namespace helper before its supervisor exits, then reap it.
    if unsafe { libc::prctl(libc::PR_SET_CHILD_SUBREAPER, 1, 0, 0, 0) } != 0 {
        return Err(std::io::Error::last_os_error().to_string());
    }
    let (mut info_read, info_write) = UnixStream::pair().map_err(|e| e.to_string())?;
    info_read
        .set_read_timeout(Some(Duration::from_secs(2)))
        .map_err(|e| e.to_string())?;
    let info_fd = info_write.as_raw_fd();
    // RLIMIT_NPROC counts tasks for the real UID, including other applications.
    let uid = unsafe { libc::getuid() };
    let baseline = std::fs::read_dir("/proc")
        .map(|entries| {
            entries
                .flatten()
                .filter(|entry| {
                    entry.file_name().to_string_lossy().parse::<u32>().is_ok()
                        && entry.metadata().is_ok_and(|m| m.uid() == uid)
                })
                .map(|entry| {
                    std::fs::read_dir(entry.path().join("task"))
                        .map(|t| t.count() as u64)
                        .unwrap_or(1)
                })
                .sum::<u64>()
        })
        .unwrap_or(128);
    let mut inherited = libc::rlimit {
        rlim_cur: 0,
        rlim_max: 0,
    };
    if unsafe { libc::getrlimit(libc::RLIMIT_NPROC, &mut inherited) } != 0 {
        return Err(std::io::Error::last_os_error().to_string());
    }
    let process_limit = baseline.saturating_add(128).min(inherited.rlim_max);
    if control.cancel.load(Ordering::SeqCst) {
        return Err("Operation stopped".into());
    }
    let bwrap = if Path::new("/usr/bin/bwrap").is_file() {
        "/usr/bin/bwrap"
    } else {
        return Err("Bubblewrap is required for isolated execution. Install bubblewrap and enable unprivileged user namespaces.".into());
    };
    let mut cmd = Command::new(bwrap);
    cmd.args([
        "--info-fd",
        &info_fd.to_string(),
        "--die-with-parent",
        "--unshare-all",
        "--cap-drop",
        "ALL",
        "--clearenv",
        "--setenv",
        "PATH",
        "/usr/bin:/bin",
        "--setenv",
        "LANG",
        "C.UTF-8",
        "--setenv",
        "HOME",
        "/tmp",
        "--ro-bind",
        "/usr",
        "/usr",
    ]);
    for name in ["/lib", "/lib64", "/bin"] {
        if Path::new(name).exists() {
            cmd.args(["--ro-bind", name, name]);
        }
    }
    if Path::new("/etc/ld.so.cache").is_file() {
        cmd.args(["--ro-bind", "/etc/ld.so.cache", "/etc/ld.so.cache"]);
    }
    cmd.args([
        "--proc",
        "/proc",
        "--dev",
        "/dev",
        "--tmpfs",
        "/tmp",
        "--dir",
        "/toolchain",
        "--ro-bind",
    ])
    .arg(toolchain)
    .arg("/toolchain");
    cmd.arg("--bind")
        .arg(work)
        .args(["/work", "--chdir", "/work", "--"])
        .arg(program)
        .args(args);
    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let memory = if compile {
        768 * 1024 * 1024
    } else {
        256 * 1024 * 1024
    };
    unsafe {
        cmd.pre_exec(move || {
            let flags = libc::fcntl(info_fd, libc::F_GETFD);
            if flags < 0 || libc::fcntl(info_fd, libc::F_SETFD, flags & !libc::FD_CLOEXEC) < 0 {
                return Err(std::io::Error::last_os_error());
            }
            if libc::setpgid(0, 0) != 0 {
                return Err(std::io::Error::last_os_error());
            }
            let limits = [
                (libc::RLIMIT_AS, memory),
                (libc::RLIMIT_CPU, if compile { 25 } else { 5 }),
                (libc::RLIMIT_NPROC, process_limit),
                (libc::RLIMIT_NOFILE, 128),
                (libc::RLIMIT_FSIZE, 8 * 1024 * 1024),
                (libc::RLIMIT_CORE, 0),
            ];
            for (kind, value) in limits {
                let limit = libc::rlimit {
                    rlim_cur: value,
                    rlim_max: value,
                };
                if libc::setrlimit(kind, &limit) != 0 {
                    return Err(std::io::Error::last_os_error());
                }
            }
            Ok(())
        });
    }
    let start = Instant::now();
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Cannot start isolated process: {e}"))?;
    drop(info_write);
    let pid = child.id();
    let mut info = Vec::new();
    let mut buffer = [0; 4096];
    let mut namespace_pid = None;
    while info.len() < 4096 {
        match info_read.read(&mut buffer) {
            Ok(0) | Err(_) => break,
            Ok(n) => {
                info.extend_from_slice(&buffer[..n]);
                if let Ok(value) = serde_json::from_slice::<Value>(&info) {
                    namespace_pid = value["child-pid"].as_u64().map(|p| p as i32);
                    break;
                }
            }
        }
    }
    drop(info_read);
    let total = Arc::new(AtomicUsize::new(0));
    let out = bounded_reader(child.stdout.take().unwrap(), total.clone(), cap);
    let err = bounded_reader(child.stderr.take().unwrap(), total.clone(), cap);
    let mut input = child.stdin.take().unwrap();
    let input_text = stdin.as_bytes().to_vec();
    let input_thread = thread::spawn(move || {
        let _ = input.write_all(&input_text);
    });
    let mut reason = None;
    let status = loop {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            break status;
        }
        if control.cancel.load(Ordering::SeqCst) {
            reason = Some("Stopped".to_string());
        } else if start.elapsed().as_millis() > time_ms as u128 {
            reason = Some(format!("Time limit exceeded ({time_ms} ms)"));
        } else if total.load(Ordering::SeqCst) > cap {
            reason = Some(format!("Output limit exceeded ({cap} bytes)"));
        }
        if reason.is_some() {
            // Kill PID 1 of the sandbox, leaving its supervisor alive to report exit.
            // The kernel kills all namespace descendants, including new sessions.
            unsafe {
                libc::kill(namespace_pid.unwrap_or(pid as i32), libc::SIGKILL);
            }
            break child.wait().map_err(|e| e.to_string())?;
        }
        thread::sleep(Duration::from_millis(10));
    };
    // Bubblewrap reports exit over its status pipe before its PID-namespace helper
    // exits. As a subreaper, wait for that exact adopted child to avoid zombies.
    if let Some(namespace_pid) = namespace_pid {
        unsafe {
            let mut status = 0;
            loop {
                let result = libc::waitpid(namespace_pid, &mut status, 0);
                if result >= 0
                    || std::io::Error::last_os_error().raw_os_error() != Some(libc::EINTR)
                {
                    break;
                }
            }
        }
    }
    let _ = input_thread.join();
    let stdout = String::from_utf8_lossy(&out.join().unwrap_or_default()).into_owned();
    let stderr = String::from_utf8_lossy(&err.join().unwrap_or_default()).into_owned();
    if stderr.starts_with("bwrap:") {
        return Err(format!(
            "Isolation unavailable; execution was refused. {stderr}"
        ));
    }
    if total.load(Ordering::SeqCst) > cap {
        reason = Some(format!("Output limit exceeded ({cap} bytes)"));
    }
    let code = if reason.is_some() {
        137
    } else {
        status.code().unwrap_or(137)
    };
    Ok(Output {
        stdout,
        stderr,
        code,
        duration_ms: start.elapsed().as_millis(),
        reason,
    })
}
#[cfg(not(target_os = "linux"))]
pub fn run(
    _toolchain: &Path,
    _work: &Path,
    _program: &str,
    _args: &[String],
    _stdin: &str,
    _compile: bool,
    _control: &Control,
    _time_ms: u64,
    _cap: usize,
) -> Result<Output, String> {
    Err("This build does not implement native Windows isolation. Use the Linux build inside WSLg; Windows/WSLg has not been validated.".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn paths_cannot_escape() {
        for bad in [
            "../a.kr",
            "/tmp/a.kr",
            "a/../../x.kr",
            "C:\\x.kr",
            "a\\b.kr",
            ".",
            "",
        ] {
            assert!(safe_relative(bad).is_err(), "{bad}");
        }
        assert!(safe_relative("src/main.kr").is_ok());
    }
}

#[cfg(all(test, target_os = "linux"))]
mod isolation_tests {
    use super::*;
    #[test]
    fn generated_files_reject_parent_symlinks() {
        use std::os::unix::fs::symlink;
        let work = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        std::fs::write(outside.path().join("secret.txt"), "not shared").unwrap();
        symlink(outside.path(), work.path().join("out")).unwrap();
        assert!(read_workspace_file(work.path(), "out/secret.txt", 1024).is_err());
        std::fs::create_dir(work.path().join("valid")).unwrap();
        std::fs::write(work.path().join("valid/a.txt"), "ok").unwrap();
        assert_eq!(
            read_workspace_file(work.path(), "valid/a.txt", 1024).unwrap(),
            "ok"
        );
    }
    #[test]
    #[ignore = "Requires Linux Bubblewrap user namespaces"]
    fn namespace_boundaries_and_output_limits() {
        let work = tempfile::tempdir().unwrap();
        let toolchain = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/toolchain");
        let control = Control::default();
        let secret = tempfile::NamedTempFile::new().unwrap();
        let denied = run(
            &toolchain,
            work.path(),
            "/usr/bin/cat",
            &[secret.path().to_string_lossy().into_owned()],
            "",
            false,
            &control,
            2000,
            4096,
        )
        .unwrap();
        assert_ne!(denied.code, 0, "Host temporary files must not be mounted");
        let host_ns = std::fs::read_link("/proc/self/ns/net").unwrap();
        let network = run(
            &toolchain,
            work.path(),
            "/usr/bin/readlink",
            &["/proc/self/ns/net".into()],
            "",
            false,
            &control,
            2000,
            4096,
        )
        .unwrap();
        assert_eq!(network.code, 0);
        assert_ne!(network.stdout.trim(), host_ns.to_string_lossy());
        let flood = run(
            &toolchain,
            work.path(),
            "/usr/bin/head",
            &["-c".into(), "100000".into(), "/dev/zero".into()],
            "",
            false,
            &control,
            2000,
            4096,
        )
        .unwrap();
        assert_ne!(flood.code, 0);
        assert!(flood
            .reason
            .as_deref()
            .unwrap_or("")
            .contains("Output limit"));
        assert!(flood.stdout.len() + flood.stderr.len() <= 4096);
        let timeout = run(
            &toolchain,
            work.path(),
            "/usr/bin/sleep",
            &["30".into()],
            "",
            false,
            &control,
            100,
            4096,
        )
        .unwrap();
        assert_ne!(timeout.code, 0);
        assert!(timeout
            .reason
            .as_deref()
            .unwrap_or("")
            .contains("Time limit"));
        // Fixed trusted fixture creates a descendant retaining the stdout pipe.
        // No application or user text is interpolated into this test command.
        let child_control = control.clone();
        let child_work = work.path().to_path_buf();
        let child_toolchain = toolchain.clone();
        let started = Instant::now();
        let descendant = thread::spawn(move || {
            run(
                &child_toolchain,
                &child_work,
                "/usr/bin/sh",
                &["-c".into(), "sleep 30 & wait".into()],
                "",
                false,
                &child_control,
                5000,
                4096,
            )
        });
        thread::sleep(Duration::from_millis(100));
        control.stop();
        let stopped = descendant.join().unwrap().unwrap();
        assert_ne!(stopped.code, 0);
        assert!(
            started.elapsed() < Duration::from_secs(2),
            "The descendant retained a process or pipe after stop"
        );
    }
}
