//! Recent-files list (docs/typora-clone-prd.md: "a short recent-files list
//! (last 5–10 files)"). No persistent file-tree browser — this is the only
//! file-history UI the app has.

use serde::{Deserialize, Serialize};
use tauri::Manager;

use crate::store::{load_json, save_json};

/// Upper bound from the PRD's "last 5–10 files" range.
pub const MAX_RECENT_FILES: usize = 10;

#[derive(Serialize, Deserialize, Default)]
struct RecentFiles {
    paths: Vec<String>,
}

/// Moves `path` to the front of `list`, removing any existing occurrence
/// first (so re-opening a file bumps it to most-recent rather than
/// duplicating it), then truncates to `cap`. Pulled out as a pure function
/// so the eviction/dedup logic is testable without touching disk.
pub fn add_recent(list: &mut Vec<String>, path: String, cap: usize) {
    list.retain(|existing| existing != &path);
    list.insert(0, path);
    list.truncate(cap);
}

fn recent_files_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| format!("could not resolve app data dir: {e}"))?
        .join("recent-files.json"))
}

#[tauri::command]
pub fn get_recent_files(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let path = recent_files_path(&app)?;
    let stored: RecentFiles = load_json(&path);
    Ok(stored.paths)
}

#[tauri::command]
pub fn add_recent_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let store_path = recent_files_path(&app)?;
    let mut stored: RecentFiles = load_json(&store_path);
    add_recent(&mut stored.paths, path, MAX_RECENT_FILES);
    save_json(&store_path, &stored)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn add_recent_inserts_at_front() {
        let mut list = vec!["b.md".to_string(), "c.md".to_string()];
        add_recent(&mut list, "a.md".to_string(), 10);
        assert_eq!(list, vec!["a.md", "b.md", "c.md"]);
    }

    #[test]
    fn add_recent_moves_existing_entry_to_front_instead_of_duplicating() {
        let mut list = vec!["a.md".to_string(), "b.md".to_string(), "c.md".to_string()];
        add_recent(&mut list, "b.md".to_string(), 10);
        assert_eq!(list, vec!["b.md", "a.md", "c.md"]);
    }

    #[test]
    fn add_recent_caps_at_n_entries() {
        let mut list = vec!["a.md".to_string(), "b.md".to_string(), "c.md".to_string()];
        add_recent(&mut list, "d.md".to_string(), 3);
        assert_eq!(list, vec!["d.md", "a.md", "b.md"]);
        assert_eq!(list.len(), 3);
    }

    #[test]
    fn add_recent_evicts_oldest_when_over_cap() {
        let mut list: Vec<String> = (0..5).map(|i| format!("{i}.md")).collect();
        add_recent(&mut list, "new.md".to_string(), 5);
        assert_eq!(list.len(), 5);
        assert_eq!(list[0], "new.md");
        // "4.md" was the oldest (last) entry and should have been evicted.
        assert!(!list.contains(&"4.md".to_string()));
    }

    #[test]
    fn add_recent_on_empty_list() {
        let mut list: Vec<String> = Vec::new();
        add_recent(&mut list, "only.md".to_string(), 10);
        assert_eq!(list, vec!["only.md"]);
    }
}
