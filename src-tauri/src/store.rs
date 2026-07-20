//! Small helper for reading/writing a struct as a flat JSON file — the
//! "local flat config file" preferences and recent-files storage described
//! in docs/typora-clone-tasks.md Phase 1. Deliberately not atomic (unlike
//! `file_io::atomic_write`): these are small, low-stakes app-state files,
//! not the user's document.

use std::fs;
use std::path::Path;

use serde::de::DeserializeOwned;
use serde::Serialize;

/// Loads `T` from `path` as JSON. Returns `T::default()` if the file
/// doesn't exist yet (first run) or fails to parse (corrupt state should
/// not crash the app — it should just reset to defaults).
pub fn load_json<T: DeserializeOwned + Default>(path: &Path) -> T {
    match fs::read_to_string(path) {
        Ok(contents) => serde_json::from_str(&contents).unwrap_or_default(),
        Err(_) => T::default(),
    }
}

/// Serializes `value` as pretty JSON and writes it to `path`, creating
/// parent directories as needed.
pub fn save_json<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| format!("could not create config dir: {e}"))?;
    }
    let json =
        serde_json::to_string_pretty(value).map_err(|e| format!("could not serialize: {e}"))?;
    fs::write(path, json).map_err(|e| format!("could not write config file: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Serialize, Deserialize, Default, PartialEq, Debug)]
    struct Sample {
        name: String,
        count: u32,
    }

    #[test]
    fn load_json_returns_default_when_file_missing() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("does-not-exist.json");

        let loaded: Sample = load_json(&path);
        assert_eq!(loaded, Sample::default());
    }

    #[test]
    fn load_json_returns_default_on_corrupt_json() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("corrupt.json");
        fs::write(&path, "{ this is not valid json").unwrap();

        let loaded: Sample = load_json(&path);
        assert_eq!(loaded, Sample::default());
    }

    #[test]
    fn save_then_load_round_trips() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nested").join("sample.json");
        let value = Sample {
            name: "hello".to_string(),
            count: 42,
        };

        save_json(&path, &value).expect("save should succeed, creating parent dirs");
        let loaded: Sample = load_json(&path);

        assert_eq!(loaded, value);
    }
}
