use crate::{
    diagnostics,
    process::{self, Control, Output},
    storage::Store,
};
use serde_json::{json, Value};
use std::{
    collections::{BTreeMap, HashSet},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Clone)]
pub struct Engine {
    inner: Arc<Inner>,
}
struct Inner {
    store: Store,
    toolchain: PathBuf,
    catalog: PathBuf,
    data: PathBuf,
    control: Control,
    busy: AtomicBool,
    ready: Mutex<Option<Value>>,
    passed: Mutex<HashSet<String>>,
}
struct Busy<'a>(&'a AtomicBool);
impl Drop for Busy<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

fn resolve(roots: &[PathBuf], name: &str) -> PathBuf {
    roots
        .iter()
        .map(|p| p.join(name))
        .find(|p| p.exists())
        .unwrap_or_else(|| roots[0].join(name))
}
fn text<'a>(v: &'a Value, key: &str) -> Result<&'a str, String> {
    v[key].as_str().ok_or_else(|| format!("Missing {key}"))
}
fn files(v: &Value) -> Result<BTreeMap<String, String>, String> {
    serde_json::from_value(v["files"].clone())
        .map_err(|_| "Source files must be an object of strings".into())
}

fn platform_name() -> String {
    let wsl = std::env::var_os("WSL_DISTRO_NAME").is_some()
        || std::fs::read_to_string("/proc/sys/kernel/osrelease")
            .is_ok_and(|release| release.to_ascii_lowercase().contains("microsoft"));
    if cfg!(target_os = "linux") && wsl {
        "Linux / WSLg (unverified)".into()
    } else {
        std::env::consts::OS.into()
    }
}

impl Engine {
    pub fn new(data: PathBuf, resources: PathBuf) -> Result<Self, String> {
        let executable = std::env::current_exe().map_err(|e| e.to_string())?;
        let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let roots = vec![
            resources,
            executable.parent().unwrap_or(Path::new(".")).to_path_buf(),
            manifest.join("resources"),
            manifest.parent().unwrap().to_path_buf(),
        ];
        Ok(Self {
            inner: Arc::new(Inner {
                store: Store::new(&data)?,
                toolchain: resolve(&roots, "toolchain"),
                catalog: resolve(&roots, "content").join("catalog.json"),
                data,
                control: Control::default(),
                busy: AtomicBool::new(false),
                ready: Mutex::new(None),
                passed: Mutex::new(HashSet::new()),
            }),
        })
    }
    pub fn dispatch(&self, request: Value) -> Result<Value, String> {
        let action = text(&request, "action")?;
        if action == "stop" {
            self.inner.control.stop();
            return Ok(json!({"stopped":true}));
        }
        match action {
            "bootstrap" => {
                let mut b = self.inner.store.bootstrap()?;
                b["toolchain"] = self.readiness();
                Ok(b)
            }
            "refreshToolchain" => {
                *self
                    .inner
                    .ready
                    .lock()
                    .map_err(|_| "Toolchain state poisoned")? = None;
                Ok(self.readiness())
            }
            "saveSettings" => {
                let s = &request["settings"];
                if !s.is_object() {
                    return Err("Settings must be an object".into());
                }
                if let Some(scale) = s["scale"].as_f64() {
                    if !(0.75..=1.5).contains(&scale) {
                        return Err("UI scale must be between 0.75 and 1.5".into());
                    }
                }
                self.inner.store.save_value("settings", s)
            }
            "saveSession" => self.inner.store.save_value("session", &request["session"]),
            "saveProgress" => {
                let id = text(&request, "lessonId")?;
                if !self
                    .inner
                    .passed
                    .lock()
                    .map_err(|_| "Test state poisoned")?
                    .contains(id)
                {
                    return Err("Complete all lesson tests before saving completion".into());
                }
                self.inner.store.complete(id)
            }
            "createProject" => self
                .inner
                .store
                .create_project(request["name"].as_str().unwrap_or("My project")),
            "openProject" => self.inner.store.open_project(),
            "openProjectAt" => self.inner.store.open_project_at(text(&request, "path")?),
            "saveProject" => self.inner.store.save_project(&request["project"]),
            "exportProject" => self.inner.store.export_project(&request["project"]),
            "exportProgress" => self.inner.store.export_progress(),
            "importProgress" => self.inner.store.import_progress(),
            "backup" => self.inner.store.backup(),
            "execute" | "test" | "explain" => {
                if self.inner.busy.swap(true, Ordering::SeqCst) {
                    return Err("Another compiler operation is running".into());
                }
                let _busy = Busy(&self.inner.busy);
                self.inner.control.reset();
                match action {
                    "execute" => self.execute(&request),
                    "test" => self.test(&request),
                    _ => self.explain(text(&request, "code")?),
                }
            }
            _ => Err(format!("Unknown native action: {action}")),
        }
    }
    fn readiness(&self) -> Value {
        let mut cached = self.inner.ready.lock().unwrap_or_else(|e| e.into_inner());
        cached.get_or_insert_with(||{
    let check=||->Result<Value,String>{
      if !cfg!(target_os="linux"){return Err("Native Windows execution is not implemented. Linux under WSLg is an unverified alternative.".into())}
      if !self.inner.toolchain.join("bin/kremen").is_file(){return Err("Bundled Kremen compiler was not found".into())}
      let work=tempfile::tempdir().map_err(|e|e.to_string())?;let c=Control::default();
      let version=process::run(&self.inner.toolchain,work.path(),"/toolchain/bin/kremen",&["--version".into()],"",true,&c,5000,65536)?;
      if version.code!=0{return Err(version.stderr)}
      if !version.stdout.contains("0.4.6"){return Err(format!("Expected Kremen 0.4.6; found {}",version.stdout.trim()))}
      std::fs::write(work.path().join("main.kr"),"package main\nfunc main() { println(42) }\n").map_err(|e|e.to_string())?;
      let output=process::run(&self.inner.toolchain,work.path(),"/toolchain/bin/kremen",&["build".into(),"main.kr".into(),"--mode=learn".into(),"--diagnostic-format=json".into(),"--cc".into(),"/usr/bin/gcc".into(),"-O0".into(),"-o".into(),"/work/program".into()],"",true,&c,30000,65536)?;
      if output.code!=0{return Err(format!("C11 backend probe failed: {}",output.stderr))}
      let run=process::run(&self.inner.toolchain,work.path(),"/work/program",&[],"",false,&c,2000,65536)?;
      if run.code!=0||run.stdout!="42\n"{return Err("Compiled program probe failed".into())}
      Ok(json!({"ready":true,"version":version.stdout.trim(),"compiler":self.inner.toolchain.join("bin/kremen"),"backend":"/usr/bin/gcc · C11 + POSIX threads (build/run probe passed)","isolation":"Bubblewrap: private PID, filesystem and network namespaces; per-process resource limits","platform":platform_name(),"message":"Offline compiler and C backend are ready"}))
    };
    check().unwrap_or_else(|e|json!({"ready":false,"version":"Kremen 0.4.6","backend":"C11 compiler + POSIX threads required","isolation":"Fail-closed Bubblewrap isolation","platform":platform_name(),"message":e}))
 }).clone()
    }
    fn compiler(
        &self,
        work: &Path,
        args: &[String],
        stdin: &str,
        compile: bool,
        time_ms: u64,
        cap: usize,
    ) -> Result<Output, String> {
        process::run(
            &self.inner.toolchain,
            work,
            "/toolchain/bin/kremen",
            args,
            stdin,
            compile,
            &self.inner.control,
            time_ms,
            cap,
        )
    }
    fn perform(
        &self,
        request: &Value,
        work: &Path,
        source: &BTreeMap<String, String>,
        time_ms: u64,
        cap: usize,
    ) -> Result<Value, String> {
        let entry = request["entry"].as_str().unwrap_or("main.kr");
        process::safe_relative(entry)?;
        if !source.contains_key(entry) {
            return Err("Entry file is absent from the project".into());
        }
        let operation = request["operation"].as_str().unwrap_or("run");
        let mode = request["mode"].as_str().unwrap_or("learn");
        if !matches!(mode, "learn" | "work") {
            return Err("Mode must be work or learn".into());
        }
        let actual = if operation == "run" {
            "build"
        } else {
            operation
        };
        if !matches!(actual, "check" | "build" | "emit-c" | "fmt") {
            return Err("Unknown compiler operation".into());
        }
        let mut args = vec![actual.into(), "--diagnostic-format=json".into()];
        if actual == "fmt" {
            args.push("-w".into());
            args.extend(source.keys().cloned());
        } else {
            args.push(format!("--mode={mode}"));
            args.extend([
                "--root".into(),
                "/work".into(),
                "--cc".into(),
                "/usr/bin/gcc".into(),
                "-O0".into(),
            ]);
            if actual == "build" {
                args.extend(["-o".into(), "/work/program".into()]);
            }
            if actual == "emit-c" {
                args.extend(["-o".into(), "/work/program.c".into()]);
            }
            args.push(entry.into());
        }
        let out = self.compiler(work, &args, "", true, 30000, 65536)?;
        let ds = diagnostics::parse(&out.stderr, source);
        let mut response = out.json();
        response["diagnostics"] = json!(ds);
        response["ok"] = json!(out.code == 0 && out.reason.is_none());
        if out.code != 0 || out.reason.is_some() {
            return Ok(response);
        }
        if operation == "run" {
            let stdin = request["stdin"].as_str().unwrap_or("");
            if stdin.len() > 1024 * 1024 {
                return Err("stdin exceeds 1 MiB".into());
            }
            let run = process::run(
                &self.inner.toolchain,
                work,
                "/work/program",
                &[],
                stdin,
                false,
                &self.inner.control,
                time_ms,
                cap,
            )?;
            response = run.json();
            response["diagnostics"] = json!(ds);
            response["ok"] = json!(run.code == 0 && run.reason.is_none());
            response["compileStderr"] = json!(out.stderr);
        } else if operation == "fmt" {
            let mut formatted = BTreeMap::new();
            for key in source.keys() {
                formatted.insert(
                    key,
                    std::fs::read_to_string(work.join(process::safe_relative(key)?))
                        .map_err(|e| e.to_string())?,
                );
            }
            response["files"] = json!(formatted);
        } else if operation == "emit-c" {
            let c = std::fs::read_to_string(work.join("program.c")).map_err(|e| e.to_string())?;
            response["emittedC"] = json!(c);
        } else if operation == "build" {
            let artifact_dir = self.inner.data.join("artifacts");
            std::fs::create_dir_all(&artifact_dir).map_err(|e| e.to_string())?;
            let stamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis();
            let destination = artifact_dir.join(format!("program-{stamp}"));
            std::fs::copy(work.join("program"), &destination).map_err(|e| e.to_string())?;
            response["artifactPath"] = json!(destination);
            response["stdout"] = json!(format!("Built {}\n", destination.display()));
        }
        Ok(response)
    }
    fn execute(&self, request: &Value) -> Result<Value, String> {
        let source = files(request)?;
        let work = tempfile::tempdir().map_err(|e| e.to_string())?;
        process::write_files(work.path(), &source)?;
        self.perform(request, work.path(), &source, 2000, 65536)
    }
    fn explain(&self, code: &str) -> Result<Value, String> {
        if code.len() != 4
            || !code.as_bytes()[0].is_ascii_alphabetic()
            || !code.as_bytes()[1..].iter().all(u8::is_ascii_digit)
        {
            return Err("Invalid diagnostic code".into());
        }
        let work = tempfile::tempdir().map_err(|e| e.to_string())?;
        let out = self.compiler(
            work.path(),
            &["explain".into(), code.into()],
            "",
            true,
            5000,
            65536,
        )?;
        if out.code != 0 {
            return Err(out.stderr);
        }
        Ok(json!({"stdout":out.stdout,"text":out.stdout,"code":code}))
    }
    fn test(&self, request: &Value) -> Result<Value, String> {
        let id = text(request, "lessonId")?;
        let catalog: Value = serde_json::from_slice(
            &std::fs::read(&self.inner.catalog)
                .map_err(|e| format!("Cannot read curriculum: {e}"))?,
        )
        .map_err(|e| e.to_string())?;
        let lesson = catalog["lessons"]
            .as_array()
            .and_then(|lessons| lessons.iter().find(|l| l["id"].as_str() == Some(id)))
            .ok_or("Lesson was not found")?;
        let tests = lesson["tests"].as_array().ok_or("Lesson has no tests")?;
        if tests.is_empty() {
            return Err("Lesson has no tests".into());
        }
        let source = files(request)?;
        let test_id = request["testId"].as_str();
        let mut results = Vec::new();
        let mut all_diagnostics = Vec::new();
        for (index, test) in tests.iter().enumerate() {
            let test_name = test["id"]
                .as_str()
                .map(str::to_owned)
                .unwrap_or_else(|| format!("test-{}", index + 1));
            if test_id.is_some_and(|id| id != test_name && id != index.to_string()) {
                continue;
            }
            if self.inner.control.cancel.load(Ordering::SeqCst) {
                return Err("Tests stopped".into());
            }
            let work = tempfile::tempdir().map_err(|e| e.to_string())?;
            process::write_files(work.path(), &source)?;
            let mut run_request = request.clone();
            run_request["operation"] = json!("run");
            run_request["mode"] = json!("learn");
            run_request["stdin"] = json!(test["stdin"].as_str().unwrap_or(""));
            let time_ms = test["timeLimitMs"]
                .as_u64()
                .unwrap_or(2000)
                .clamp(100, 10000);
            let cap = test["outputLimitBytes"]
                .as_u64()
                .unwrap_or(65536)
                .clamp(1024, 262144) as usize;
            let actual = self.perform(&run_request, work.path(), &source, time_ms, cap)?;
            let expected = test.get("expected").unwrap_or(test);
            let stdout = expected["stdout"].as_str().unwrap_or("");
            let stderr = expected["stderr"].as_str().unwrap_or("");
            let exit = expected["exitCode"].as_i64().unwrap_or(0);
            let compile_error = test
                .get("expectedCompilationError")
                .or_else(|| expected.get("compilationError"));
            let mut passed;
            let mut detail = String::new();
            if let Some(error) = compile_error {
                let code = error
                    .as_str()
                    .or_else(|| error["code"].as_str())
                    .unwrap_or("");
                passed = actual["diagnostics"].as_array().is_some_and(|ds| {
                    ds.iter()
                        .any(|d| code.is_empty() || d["code"].as_str() == Some(code))
                }) && actual["exitCode"].as_i64() != Some(0);
                detail = format!("Expected compilation diagnostic {code}");
            } else {
                passed = actual["stdout"].as_str() == Some(stdout)
                    && actual["stderr"].as_str() == Some(stderr)
                    && actual["exitCode"].as_i64() == Some(exit)
                    && actual["message"].is_null();
            }
            let expected_files = test.get("files").or_else(|| expected.get("files"));
            let checks: Vec<(&str, &str)> = match expected_files {
                Some(Value::Array(items)) => items
                    .iter()
                    .filter_map(|item| Some((item["path"].as_str()?, item["content"].as_str()?)))
                    .collect(),
                Some(Value::Object(items)) => items
                    .iter()
                    .filter_map(|(path, content)| Some((path.as_str(), content.as_str()?)))
                    .collect(),
                _ => Vec::new(),
            };
            for (relative, content) in checks {
                let file_ok = process::read_workspace_file(work.path(), relative, 1024 * 1024)
                    .ok()
                    .as_deref()
                    == Some(content);
                if !file_ok {
                    passed = false;
                    detail.push_str(&format!(" File mismatch: {relative}."));
                }
            }
            if let Some(ds) = actual["diagnostics"].as_array() {
                all_diagnostics.extend(ds.iter().cloned());
            }
            if let Some(reason) = actual["message"].as_str() {
                detail.push_str(reason)
            }
            results.push(json!({"id":test_name,"name":test.get("name").cloned().unwrap_or_else(||json!(test_name)),"passed":passed,"expected":format!("stdout: {stdout:?}\nstderr: {stderr:?}\nexit: {exit}"),"actual":format!("stdout: {:?}\nstderr: {:?}\nexit: {}",actual["stdout"].as_str().unwrap_or(""),actual["stderr"].as_str().unwrap_or(""),actual["exitCode"]),"message":detail,"durationMs":actual["durationMs"]}));
        }
        if results.is_empty() {
            return Err("Requested test was not found".into());
        }
        let passed = results.iter().all(|r| r["passed"] == true);
        if passed && test_id.is_none() {
            self.inner
                .passed
                .lock()
                .map_err(|_| "Test state poisoned")?
                .insert(id.into());
        }
        Ok(json!({"ok":passed,"passed":passed,"tests":results,"diagnostics":all_diagnostics}))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[ignore = "Requires working Linux user namespaces and bundled Kremen/C backend"]
    fn real_compiler_roundtrip_stop_and_isolation() {
        let data = tempfile::tempdir().unwrap();
        let e = Engine::new(
            data.path().to_path_buf(),
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources"),
        )
        .unwrap();
        let readiness = e.readiness();
        assert_eq!(readiness["ready"], true, "{readiness}");
        let run=e.dispatch(json!({"action":"execute","operation":"run","mode":"learn","entry":"main.kr","files":{"main.kr":"package main\nfunc main() { println(42) }\n"}})).unwrap();
        assert_eq!(run["stdout"], "42\n");
        assert_eq!(run["exitCode"], 0);
        let bad=e.dispatch(json!({"action":"execute","operation":"check","mode":"learn","entry":"main.kr","files":{"main.kr":"package main\nfunc main() {\n\tprintln(\"ёж😀\"); println(missing)\n}\n"}})).unwrap();
        assert!(!bad["diagnostics"].as_array().unwrap().is_empty());
        assert!(bad["diagnostics"][0]["startColumn"].as_u64().unwrap() > 1);
        let loop_engine = e.clone();
        let handle = std::thread::spawn(move || {
            loop_engine.dispatch(json!({"action":"execute","operation":"run","mode":"work","entry":"main.kr","files":{"main.kr":"package main\nfunc main() { for {} }\n"}}))
        });
        std::thread::sleep(std::time::Duration::from_millis(500));
        e.dispatch(json!({"action":"stop"})).unwrap();
        let stopped = handle.join().unwrap();
        assert!(stopped.is_err() || stopped.unwrap()["exitCode"] != 0);
        assert!(e.dispatch(json!({"action":"execute","operation":"check","files":{"../escape.kr":"package main"}})).is_err());
    }
}

#[cfg(test)]
mod curriculum_integration {
    use super::*;
    #[test]
    #[ignore = "Requires bundled compiler, GCC, working Linux user namespaces"]
    fn all_solutions_test_and_persist() {
        let data = tempfile::tempdir().unwrap();
        let resources = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources");
        let engine = Engine::new(data.path().to_path_buf(), resources.clone()).unwrap();
        let catalog: Value =
            serde_json::from_slice(&std::fs::read(&engine.inner.catalog).unwrap()).unwrap();
        for lesson in catalog["lessons"].as_array().unwrap() {
            let id = lesson["id"].as_str().unwrap();
            let result=engine.dispatch(json!({"action":"test","lessonId":id,"files":{"main.kr":lesson["solution"]},"entry":"main.kr","mode":"work"})).unwrap();
            assert_eq!(result["passed"], true, "{id}: {result}");
            engine
                .dispatch(json!({"action":"saveProgress","lessonId":id}))
                .unwrap();
        }
        let count = catalog["lessons"].as_array().unwrap().len();
        drop(engine);
        let restored = Engine::new(data.path().to_path_buf(), resources).unwrap();
        assert_eq!(
            restored.inner.store.bootstrap().unwrap()["progress"]["completed"]
                .as_array()
                .unwrap()
                .len(),
            count
        );
    }
    #[test]
    #[ignore = "Requires bundled compiler, GCC, working Linux user namespaces"]
    fn expected_compiler_error_is_a_real_test() {
        let data = tempfile::tempdir().unwrap();
        let resources = tempfile::tempdir().unwrap();
        std::fs::create_dir(resources.path().join("content")).unwrap();
        std::fs::write(resources.path().join("content/catalog.json"),json!({"lessons":[{"id":"negative","tests":[{"id":"unknown","expectedCompilationError":{"code":"E107"}}]}]}).to_string()).unwrap();
        let engine =
            Engine::new(data.path().to_path_buf(), resources.path().to_path_buf()).unwrap();
        let result=engine.dispatch(json!({"action":"test","lessonId":"negative","files":{"main.kr":"package main\nfunc main() { println(missing) }\n"},"entry":"main.kr","mode":"learn"})).unwrap();
        assert_eq!(result["passed"], true, "{result}");
    }
    #[test]
    #[ignore = "Requires bundled compiler, GCC, working Linux user namespaces"]
    fn external_project_with_local_imports() {
        let data = tempfile::tempdir().unwrap();
        let project = tempfile::tempdir().unwrap();
        let source =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../vendor/kremen/examples/modules");
        for name in [
            "main.kr",
            "math/vec/type.kr",
            "math/vec/type.krh",
            "math/vec/operations.kr",
        ] {
            let dest = project.path().join(name);
            std::fs::create_dir_all(dest.parent().unwrap()).unwrap();
            std::fs::copy(source.join(name), dest).unwrap();
        }
        let engine = Engine::new(
            data.path().to_path_buf(),
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources"),
        )
        .unwrap();
        let opened = engine
            .dispatch(json!({"action":"openProjectAt","path":project.path()}))
            .unwrap();
        assert_eq!(opened["files"].as_object().unwrap().len(), 4);
        let result=engine.dispatch(json!({"action":"execute","operation":"run","files":opened["files"],"entry":opened["entry"],"mode":"work"})).unwrap();
        assert_eq!(result["stdout"], "7\n");
        assert_eq!(result["exitCode"], 0);
        for operation in ["check", "fmt", "emit-c", "build"] {
            let response=engine.dispatch(json!({"action":"execute","operation":operation,"files":opened["files"],"entry":opened["entry"],"mode":"work"})).unwrap();
            assert_eq!(response["exitCode"], 0, "{operation}: {response}");
            if operation == "fmt" {
                assert_eq!(response["files"].as_object().unwrap().len(), 4);
            }
            if operation == "emit-c" {
                assert!(response["emittedC"].as_str().unwrap().contains("main("));
            }
            if operation == "build" {
                assert!(Path::new(response["artifactPath"].as_str().unwrap()).is_file());
            }
        }
        let explanation = engine
            .dispatch(json!({"action":"explain","code":"E107"}))
            .unwrap();
        assert!(explanation["text"].as_str().unwrap().contains("E107"));
    }
}
