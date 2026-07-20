mod diagrams;
mod file_io;
mod preferences;
mod recent_files;
mod store;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            diagrams::save_diagram,
            file_io::open_file,
            file_io::save_file,
            recent_files::get_recent_files,
            recent_files::add_recent_file,
            preferences::get_preferences,
            preferences::set_preferences,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    // Trivial scaffolding check per Phase 0 requirement: confirm a red -> green
    // test cycle runs cleanly in `cargo test` before any real application code
    // is written.
    #[test]
    fn sanity_check() {
        assert_eq!(1 + 1, 2);
    }
}
