use tauri::Manager;
mod diagnostics;
mod engine;
mod process;
mod storage;

#[tauri::command]
async fn dispatch(
    request: serde_json::Value,
    state: tauri::State<'_, engine::Engine>,
) -> Result<serde_json::Value, String> {
    let engine = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || engine.dispatch(request))
        .await
        .map_err(|e| e.to_string())?
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data)?;
            let resources = app.path().resource_dir()?;
            let engine = engine::Engine::new(data, resources).map_err(std::io::Error::other)?;
            app.manage(engine);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![dispatch])
        .run(tauri::generate_context!())
        .expect("Unable to start Kremen Learn");
}
