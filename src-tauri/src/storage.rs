//! Local SQLite state and explicitly selected, conflict-checked project files.
use rusqlite::{params, Connection};
use serde_json::{json, Map, Value};
use std::{
    collections::BTreeMap,
    fs,
    path::{Component, Path, PathBuf},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};

const MAX_BYTES: usize = 16 * 1024 * 1024;
const MAX_FILES: usize = 256;

pub struct Store {
    conn: Mutex<Connection>,
    data_dir: PathBuf,
}

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
fn stamp() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos()
}
fn fingerprint(text: &str) -> String {
    let mut n = 0xcbf29ce484222325u64;
    for b in text.bytes() {
        n = (n ^ u64::from(b)).wrapping_mul(0x100000001b3);
    }
    format!("{}:{n:016x}", text.len())
}

pub fn safe_relative(path: &str) -> Result<PathBuf, String> {
    if path.is_empty() || path.contains('\\') || path.contains(':') || path.contains('\0') {
        return Err("Invalid relative project path".into());
    }
    let p = Path::new(path);
    if p.components().any(|c| !matches!(c, Component::Normal(_))) {
        return Err("Project paths must stay inside the selected directory".into());
    }
    if !matches!(p.extension().and_then(|e| e.to_str()), Some("kr" | "krh")) {
        return Err("Only .kr and .krh project source files are supported".into());
    }
    Ok(p.to_owned())
}

fn checked_destination(root: &Path, relative: &str) -> Result<PathBuf, String> {
    let p = safe_relative(relative)?;
    let mut cursor = root.to_owned();
    if fs::symlink_metadata(root)
        .map_err(err)?
        .file_type()
        .is_symlink()
    {
        return Err("Symbolic-link project directories are not supported".into());
    }
    for part in p.components() {
        cursor.push(part.as_os_str());
        match fs::symlink_metadata(&cursor) {
            Ok(m) if m.file_type().is_symlink() => {
                return Err("Symbolic links are not allowed in projects".into())
            }
            Ok(_) => (),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
            Err(e) => return Err(err(e)),
        }
    }
    Ok(cursor)
}

fn read_sources(root: &Path) -> Result<BTreeMap<String, String>, String> {
    fn visit(
        root: &Path,
        dir: &Path,
        files: &mut BTreeMap<String, String>,
        bytes: &mut usize,
        depth: usize,
    ) -> Result<(), String> {
        if depth > 20 {
            return Err("Project directory nesting exceeds 20 levels".into());
        }
        for item in fs::read_dir(dir).map_err(err)? {
            let item = item.map_err(err)?;
            let ty = item.file_type().map_err(err)?;
            let path = item.path();
            if ty.is_symlink() {
                continue;
            }
            if ty.is_dir() {
                let name = item.file_name();
                if matches!(
                    name.to_str(),
                    Some(".git" | "target" | "node_modules" | "build")
                ) {
                    continue;
                }
                visit(root, &path, files, bytes, depth + 1)?;
            } else if ty.is_file()
                && matches!(
                    path.extension().and_then(|e| e.to_str()),
                    Some("kr" | "krh")
                )
            {
                if files.len() >= MAX_FILES {
                    return Err("Project has more than 256 source files".into());
                }
                let size = item.metadata().map_err(err)?.len() as usize;
                *bytes = bytes.checked_add(size).ok_or("Project is too large")?;
                if *bytes > MAX_BYTES {
                    return Err("Project source exceeds 16 MiB".into());
                }
                let rel = path
                    .strip_prefix(root)
                    .map_err(err)?
                    .to_string_lossy()
                    .replace('\\', "/");
                safe_relative(&rel)?;
                files.insert(rel, fs::read_to_string(path).map_err(err)?);
            }
        }
        Ok(())
    }
    let mut files = BTreeMap::new();
    visit(root, root, &mut files, &mut 0, 0)?;
    Ok(files)
}

fn project_files(project: &Value) -> Result<BTreeMap<String, String>, String> {
    let obj = project
        .get("files")
        .and_then(Value::as_object)
        .ok_or("Project files are missing")?;
    if obj.is_empty() || obj.len() > MAX_FILES {
        return Err("A project needs 1–256 source files".into());
    }
    let mut total = 0usize;
    let mut result = BTreeMap::new();
    for (name, value) in obj {
        safe_relative(name)?;
        let text = value.as_str().ok_or("Source contents must be text")?;
        total = total
            .checked_add(text.len())
            .ok_or("Project is too large")?;
        if total > MAX_BYTES {
            return Err("Project source exceeds 16 MiB".into());
        }
        result.insert(name.clone(), text.to_owned());
    }
    Ok(result)
}

impl Store {
    pub fn new(data_dir: &Path) -> Result<Self, String> {
        fs::create_dir_all(data_dir).map_err(err)?;
        let conn = Connection::open(data_dir.join("kremen-learn.sqlite3")).map_err(err)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL);").map_err(err)?;
        Ok(Self {
            conn: Mutex::new(conn),
            data_dir: data_dir.to_owned(),
        })
    }
    pub fn value(&self, key: &str) -> Value {
        let Ok(conn) = self.conn.lock() else {
            return Value::Null;
        };
        conn.query_row("SELECT value FROM state WHERE key=?1", [key], |r| {
            r.get::<_, String>(0)
        })
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(Value::Null)
    }
    pub fn save_value(&self, key: &str, value: &Value) -> Result<Value, String> {
        let data = serde_json::to_string(value).map_err(err)?;
        if data.len() > MAX_BYTES * 2 {
            return Err("Saved state exceeds 32 MiB".into());
        }
        self.conn.lock().map_err(err)?.execute("INSERT INTO state(key,value) VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value", params![key,data]).map_err(err)?;
        Ok(value.clone())
    }
    pub fn bootstrap(&self) -> Result<Value, String> {
        let mut settings = self.value("settings");
        if !settings.is_object() {
            settings = json!({"locale":"ru","theme":"dark","mode":"learn","scale":1});
        }
        let mut progress = self.value("progress");
        if !progress.is_object() {
            progress = json!({"completed":[],"currentLessonId":"01-first-program"});
        }
        let projects = self.value("projects");
        Ok(
            json!({"settings":settings,"progress":progress,"session":self.value("session"),"projects":projects.as_array().cloned().unwrap_or_default()}),
        )
    }
    pub fn complete(&self, lesson_id: &str) -> Result<Value, String> {
        if lesson_id.is_empty() || lesson_id.len() > 128 {
            return Err("Invalid lesson identifier".into());
        }
        let mut p = self.value("progress");
        if !p.is_object() {
            p = json!({"completed":[]});
        }
        if !p["completed"].is_array() {
            p["completed"] = json!([]);
        }
        let completed = p["completed"].as_array_mut().unwrap();
        if !completed.iter().any(|v| v.as_str() == Some(lesson_id)) {
            completed.push(json!(lesson_id));
        }
        p["currentLessonId"] = json!(lesson_id);
        self.save_value("progress", &p)
    }
    fn remember(&self, project: Value) -> Result<Value, String> {
        let mut projects = self
            .value("projects")
            .as_array()
            .cloned()
            .unwrap_or_default();
        projects.retain(|p| p["path"] != project["path"]);
        projects.insert(0, project.clone());
        projects.truncate(40);
        self.save_value("projects", &json!(projects))?;
        Ok(project)
    }
    fn load_project(&self, root: &Path, name: &str) -> Result<Value, String> {
        if fs::symlink_metadata(root)
            .map_err(err)?
            .file_type()
            .is_symlink()
        {
            return Err("Select the actual project directory, not a symbolic link".into());
        }
        let root = root.canonicalize().map_err(err)?;
        let files = read_sources(&root)?;
        if files.is_empty() {
            return Err("No .kr or .krh files found in the selected directory".into());
        }
        let entry = if files.contains_key("main.kr") {
            "main.kr".to_owned()
        } else {
            files
                .keys()
                .find(|p| p.ends_with(".kr"))
                .cloned()
                .ok_or("Project needs a .kr entry file")?
        };
        let hashes: Map<String, Value> = files
            .iter()
            .map(|(k, v)| (k.clone(), json!(fingerprint(v))))
            .collect();
        self.remember(json!({"id":format!("p{:x}",stamp()),"name":name,"path":root,"files":files,"entry":entry,"modified":stamp()/1_000_000,"diskFingerprint":hashes}))
    }
    pub fn create_project(&self, name: &str) -> Result<Value, String> {
        let name = name.trim();
        if name.is_empty() || name.len() > 100 || name.chars().any(|c| c.is_control()) {
            return Err("Use a project name of 1–100 characters".into());
        }
        let root = self
            .data_dir
            .join("projects")
            .join(format!("project-{:x}", stamp()));
        fs::create_dir_all(&root).map_err(err)?;
        fs::write(
            root.join("main.kr"),
            "package main\n\nfunc main() {\n    println(\"Hello, Kremen!\")\n}\n",
        )
        .map_err(err)?;
        self.load_project(&root, name)
    }
    pub fn open_project(&self) -> Result<Value, String> {
        let root = rfd::FileDialog::new()
            .set_title("Open Kremen project / Открыть проект Kremen")
            .pick_folder()
            .ok_or("Cancelled")?;
        let name = root
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "Kremen project".into());
        self.load_project(&root, &name)
    }
    pub fn open_project_at(&self, path: &str) -> Result<Value, String> {
        let root = Path::new(path);
        if !root.is_absolute() {
            return Err("Enter an absolute project directory path".into());
        }
        let name = root
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "Kremen project".into());
        self.load_project(root, &name)
    }
    pub fn save_project(&self, project: &Value) -> Result<Value, String> {
        let files = project_files(project)?;
        let path = project["path"]
            .as_str()
            .ok_or("Open or create a project before saving")?;
        let root = Path::new(path).canonicalize().map_err(err)?;
        let records = self.value("projects");
        let registered = records
            .as_array()
            .and_then(|a| a.iter().find(|p| p["path"].as_str() == root.to_str()))
            .ok_or("Project directory has not been opened in this application")?;
        let actual = read_sources(&root)?;
        let known = registered["diskFingerprint"]
            .as_object()
            .ok_or("Reopen the project to establish its saved version")?;
        let current: Map<String, Value> = actual
            .iter()
            .map(|(k, v)| (k.clone(), json!(fingerprint(v))))
            .collect();
        if &current != known {
            return Err("Save conflict: files changed outside Kremen Learn. Reopen the project to load the disk version, or export your edits to another directory.".into());
        }
        for (name, text) in &files {
            let dest = checked_destination(&root, name)?;
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent).map_err(err)?;
            }
            let temp = dest.with_extension(format!("kr-save-{:x}", stamp()));
            fs::write(&temp, text).map_err(err)?;
            #[cfg(windows)]
            if dest.exists() {
                fs::remove_file(&dest).map_err(err)?;
            }
            fs::rename(&temp, &dest).map_err(err)?;
        }
        // Removed tabs do not delete disk files. Deletion requires an explicit file operation.
        let name = project["name"].as_str().unwrap_or("Kremen project");
        self.load_project(&root, name)
    }
    pub fn export_project(&self, project: &Value) -> Result<Value, String> {
        let files = project_files(project)?;
        let parent = rfd::FileDialog::new()
            .set_title("Export project to directory / Экспорт проекта")
            .pick_folder()
            .ok_or("Cancelled")?;
        let root = parent.join(format!("kremen-project-{:x}", stamp()));
        fs::create_dir(&root).map_err(err)?;
        for (name, text) in files {
            let dest = checked_destination(&root, &name)?;
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent).map_err(err)?;
            }
            fs::write(dest, text).map_err(err)?;
        }
        Ok(json!({"ok":true,"path":root}))
    }
    fn save_json_dialog(&self, name: &str, value: &Value) -> Result<Value, String> {
        let path = rfd::FileDialog::new()
            .add_filter("JSON", &["json"])
            .set_file_name(name)
            .save_file()
            .ok_or("Cancelled")?;
        fs::write(&path, serde_json::to_vec_pretty(value).map_err(err)?).map_err(err)?;
        Ok(json!({"ok":true,"path":path}))
    }
    pub fn export_progress(&self) -> Result<Value, String> {
        self.save_json_dialog("kremen-learn-progress.json", &json!({"format":"kremen-learn-progress","version":1,"progress":self.value("progress")}))
    }
    pub fn import_progress(&self) -> Result<Value, String> {
        let path = rfd::FileDialog::new()
            .add_filter("JSON", &["json"])
            .pick_file()
            .ok_or("Cancelled")?;
        let meta = fs::metadata(&path).map_err(err)?;
        if meta.len() > MAX_BYTES as u64 {
            return Err("Progress import exceeds 16 MiB".into());
        }
        let v: Value = serde_json::from_slice(&fs::read(path).map_err(err)?).map_err(err)?;
        if v["version"] != 1
            || !matches!(
                v["format"].as_str(),
                Some("kremen-learn-progress" | "kremen-learn-backup")
            )
        {
            return Err("Unsupported progress format or version".into());
        }
        let progress = &v["progress"];
        let complete = progress["completed"]
            .as_array()
            .ok_or("Progress must contain a completed lesson list")?;
        if complete.len() > 10000
            || complete
                .iter()
                .any(|x| x.as_str().map(|s| s.len() > 128).unwrap_or(true))
        {
            return Err("Invalid completed lesson list".into());
        }
        self.save_value("progress", progress)
    }
    pub fn backup(&self) -> Result<Value, String> {
        self.save_json_dialog("kremen-learn-backup.json", &json!({"format":"kremen-learn-backup","version":1,"progress":self.value("progress"),"settings":self.value("settings"),"session":self.value("session"),"projects":self.value("projects")}))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_traversal_and_foreign_paths() {
        for p in [
            "../main.kr",
            "/tmp/main.kr",
            "a/../../main.kr",
            "C:/main.kr",
            "a\\main.kr",
            "file.txt",
            "",
        ] {
            assert!(safe_relative(p).is_err(), "{p}");
        }
        assert!(safe_relative("src/helpers.krh").is_ok());
    }
    #[test]
    fn persists_progress_and_retains_completion() {
        let dir = tempfile::tempdir().unwrap();
        {
            let s = Store::new(dir.path()).unwrap();
            s.complete("hello").unwrap();
            s.complete("hello").unwrap();
            s.complete("types").unwrap();
        }
        let s = Store::new(dir.path()).unwrap();
        assert_eq!(s.value("progress")["completed"], json!(["hello", "types"]));
    }
    #[test]
    fn detects_external_project_changes() {
        let dir = tempfile::tempdir().unwrap();
        let s = Store::new(dir.path()).unwrap();
        let p = s.create_project("Test").unwrap();
        fs::write(
            Path::new(p["path"].as_str().unwrap()).join("main.kr"),
            "external edits",
        )
        .unwrap();
        assert!(s.save_project(&p).unwrap_err().contains("conflict"));
    }
    #[cfg(unix)]
    #[test]
    fn refuses_symlink_destination() {
        let d = tempfile::tempdir().unwrap();
        let other = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(other.path(), d.path().join("sub")).unwrap();
        assert!(checked_destination(d.path(), "sub/main.kr").is_err());
    }
}
