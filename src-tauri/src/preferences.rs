//! Preferences store (docs/typora-clone-tasks.md Phase 1: "local
//! preferences store as a flat local config file"). Covers theme,
//! focus-mode default, and autosave interval — the settings the PRD calls
//! out as needing to persist across restarts.

use serde::{Deserialize, Serialize};
use tauri::Manager;

use crate::store::{load_json, save_json};

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Light,
    Dark,
}

impl Default for Theme {
    fn default() -> Self {
        Theme::Light
    }
}

#[derive(Serialize, Deserialize, Clone, PartialEq, Debug)]
#[serde(default)]
pub struct Preferences {
    pub theme: Theme,
    pub focus_mode_default: bool,
    /// PRD: "autosave to a recovery buffer at a defined interval, e.g.
    /// every 5-10s or on pause in typing" — 10s default, the top of that
    /// range; user-configurable interval is explicitly deferred to Phase 3.
    pub autosave_interval_secs: u32,
}

impl Default for Preferences {
    fn default() -> Self {
        Preferences {
            theme: Theme::default(),
            focus_mode_default: false,
            autosave_interval_secs: 10,
        }
    }
}

fn preferences_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| format!("could not resolve app data dir: {e}"))?
        .join("preferences.json"))
}

#[tauri::command]
pub fn get_preferences(app: tauri::AppHandle) -> Result<Preferences, String> {
    Ok(load_json(&preferences_path(&app)?))
}

#[tauri::command]
pub fn set_preferences(app: tauri::AppHandle, preferences: Preferences) -> Result<(), String> {
    save_json(&preferences_path(&app)?, &preferences)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_light_theme_focus_mode_off_ten_second_autosave() {
        let prefs = Preferences::default();
        assert_eq!(prefs.theme, Theme::Light);
        assert!(!prefs.focus_mode_default);
        assert_eq!(prefs.autosave_interval_secs, 10);
    }

    #[test]
    fn preferences_round_trip_through_json() {
        let prefs = Preferences {
            theme: Theme::Dark,
            focus_mode_default: true,
            autosave_interval_secs: 5,
        };

        let json = serde_json::to_string(&prefs).unwrap();
        let parsed: Preferences = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed, prefs);
    }

    #[test]
    fn theme_serializes_as_lowercase_string() {
        let json = serde_json::to_string(&Theme::Dark).unwrap();
        assert_eq!(json, "\"dark\"");
    }

    #[test]
    fn missing_fields_in_stored_json_fall_back_to_defaults() {
        // Simulates loading a preferences.json from an older app version
        // that predates a newly-added field — #[serde(default)] on the
        // struct means this shouldn't fail to parse.
        let partial_json = r#"{"theme": "dark"}"#;
        let parsed: Preferences = serde_json::from_str(partial_json).unwrap();

        assert_eq!(parsed.theme, Theme::Dark);
        assert!(!parsed.focus_mode_default);
        assert_eq!(parsed.autosave_interval_secs, 10);
    }
}
