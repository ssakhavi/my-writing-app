// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Decodes a base64-encoded PNG payload, returning the raw bytes and a
/// UUID-based filename to avoid collisions. Pulled out of the `#[tauri::command]`
/// below so it can be unit tested without an `AppHandle`.
fn decode_diagram_png(png_base64: &str) -> Result<(Vec<u8>, String), String> {
    use base64::Engine;

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(png_base64)
        .map_err(|e| format!("invalid base64 image data: {e}"))?;
    let filename = format!("{}.png", uuid::Uuid::new_v4());

    Ok((bytes, filename))
}

/// Decodes a base64-encoded PNG (produced by the tldraw diagram panel) and
/// writes it to a `diagrams/` subfolder of the app's data directory,
/// returning the absolute path so the frontend can insert it as a markdown
/// image reference.
#[tauri::command]
fn save_diagram(app: tauri::AppHandle, png_base64: &str) -> Result<String, String> {
    use tauri::Manager;

    let (bytes, filename) = decode_diagram_png(png_base64)?;

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("could not resolve app data dir: {e}"))?;
    let diagrams_dir = data_dir.join("diagrams");
    std::fs::create_dir_all(&diagrams_dir)
        .map_err(|e| format!("could not create diagrams dir: {e}"))?;

    let file_path = diagrams_dir.join(&filename);
    std::fs::write(&file_path, bytes).map_err(|e| format!("could not write diagram: {e}"))?;

    Ok(file_path.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, save_diagram])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    // Trivial scaffolding check per Phase 0 requirement: confirm a red -> green
    // test cycle runs cleanly in `cargo test` before any real application code
    // is written.
    #[test]
    fn sanity_check() {
        assert_eq!(1 + 1, 2);
    }

    #[test]
    fn decode_diagram_png_round_trips_valid_base64() {
        use base64::Engine;

        let original = b"not a real png, just bytes for the round-trip test";
        let encoded = base64::engine::general_purpose::STANDARD.encode(original);

        let (bytes, filename) = decode_diagram_png(&encoded).expect("valid base64 should decode");

        assert_eq!(bytes, original);
        assert!(filename.ends_with(".png"));
        // UUID v4 string form is 36 chars; plus ".png" (4 chars) = 40.
        assert_eq!(filename.len(), 40);
    }

    #[test]
    fn decode_diagram_png_rejects_invalid_base64() {
        let result = decode_diagram_png("not valid base64 !!!");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("invalid base64"));
    }

    #[test]
    fn decode_diagram_png_generates_unique_filenames() {
        use base64::Engine;
        let encoded = base64::engine::general_purpose::STANDARD.encode(b"same input");

        let (_, filename_a) = decode_diagram_png(&encoded).unwrap();
        let (_, filename_b) = decode_diagram_png(&encoded).unwrap();

        assert_ne!(filename_a, filename_b);
    }
}
