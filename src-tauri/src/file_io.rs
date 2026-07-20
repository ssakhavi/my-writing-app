//! `open_file` / `save_file` commands (docs/typora-clone-system-design.md
//! section on the file-I/O command boundary).

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;

#[derive(Serialize)]
pub struct OpenedFile {
    pub path: String,
    pub content: String,
    /// Unix timestamp (seconds) of the file's last modification, so the
    /// frontend can detect external changes later if needed.
    pub modified_at: u64,
}

/// Reads `path` as UTF-8 markdown and returns its content plus metadata.
/// Pulled out of the `#[tauri::command]` below so it's testable without an
/// `AppHandle` or a real dialog.
pub fn read_markdown_file(path: &Path) -> Result<OpenedFile, String> {
    let content =
        fs::read_to_string(path).map_err(|e| format!("could not read {}: {e}", path.display()))?;

    let metadata = fs::metadata(path).map_err(|e| format!("could not read file metadata: {e}"))?;
    let modified_at = metadata
        .modified()
        .map_err(|e| format!("could not read modification time: {e}"))?
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("file modification time is before the Unix epoch: {e}"))?
        .as_secs();

    Ok(OpenedFile {
        path: path.to_string_lossy().into_owned(),
        content,
        modified_at,
    })
}

/// Reads a markdown file from `path`, or — if `path` is `None` — opens a
/// native "open file" dialog first and reads whatever the user picks.
/// Returns `Err` if the dialog is cancelled.
///
/// The dialog path can't be exercised by an automated test (it drives real
/// OS UI); `read_markdown_file` above covers the part that can be.
#[tauri::command]
pub fn open_file(app: tauri::AppHandle, path: Option<String>) -> Result<OpenedFile, String> {
    use tauri_plugin_dialog::DialogExt;

    let resolved_path: PathBuf = match path {
        Some(p) => PathBuf::from(p),
        None => app
            .dialog()
            .file()
            .add_filter("Markdown", &["md", "markdown"])
            .blocking_pick_file()
            .ok_or_else(|| "no file selected".to_string())?
            .into_path()
            .map_err(|e| format!("could not resolve selected file path: {e}"))?,
    };

    read_markdown_file(&resolved_path)
}

/// Rejects content pulldown-cmark can't safely parse. CommonMark parsers
/// (by design) are permissive — most "malformed" markdown is still valid,
/// just interpreted literally — so this is a narrower safety net than the
/// name might suggest: it catches NUL bytes (which corrupt plain-text
/// files) and parser panics (defensive; pulldown-cmark is mature and this
/// should be unreachable in practice), not stylistic markdown issues.
pub fn validate_markdown(content: &str) -> Result<(), String> {
    if content.contains('\0') {
        return Err("content contains a NUL byte and can't be saved as text".to_string());
    }

    std::panic::catch_unwind(|| {
        // Force full iteration so parsing actually happens, not just gets
        // constructed lazily.
        pulldown_cmark::Parser::new(content).count()
    })
    .map_err(|_| "content could not be parsed as markdown".to_string())?;

    Ok(())
}

/// Writes `content` to `path` atomically: write to a temp file in the same
/// directory, then rename over the target. A crash or power loss mid-write
/// leaves either the old file or the new one intact, never a half-written
/// file.
pub fn atomic_write(path: &Path, content: &str) -> Result<(), String> {
    let dir = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));

    let mut tmp = tempfile::NamedTempFile::new_in(dir)
        .map_err(|e| format!("could not create temp file for atomic write: {e}"))?;
    tmp.write_all(content.as_bytes())
        .map_err(|e| format!("could not write temp file: {e}"))?;
    tmp.flush()
        .map_err(|e| format!("could not flush temp file: {e}"))?;
    tmp.persist(path)
        .map_err(|e| format!("could not finalize save to {}: {e}", path.display()))?;

    Ok(())
}

/// Validates `content`, then atomically writes it to `path`. Rejects and
/// does not touch the file at all if validation fails.
#[tauri::command]
pub fn save_file(path: String, content: String) -> Result<(), String> {
    validate_markdown(&content)?;
    atomic_write(Path::new(&path), &content)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn read_markdown_file_returns_content_and_metadata() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("doc.md");
        fs::write(&path, "# Hello\n").unwrap();

        let opened = read_markdown_file(&path).expect("known file should read cleanly");

        assert_eq!(opened.content, "# Hello\n");
        assert_eq!(opened.path, path.to_string_lossy());
        assert!(opened.modified_at > 0);
    }

    #[test]
    fn read_markdown_file_errors_on_missing_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("does-not-exist.md");

        let result = read_markdown_file(&path);

        assert!(result.is_err());
    }

    #[test]
    fn validate_markdown_accepts_ordinary_markdown() {
        assert!(
            validate_markdown("# Heading\n\nSome **text** and a [link](https://x.com).\n").is_ok()
        );
    }

    #[test]
    fn validate_markdown_accepts_unusual_but_valid_markdown() {
        // CommonMark is permissive by design: stray formatting characters
        // are just literal text, not errors.
        assert!(validate_markdown("** not closed, *nested* oddly ~~ everywhere").is_ok());
    }

    #[test]
    fn validate_markdown_rejects_nul_bytes() {
        let result = validate_markdown("hello\0world");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("NUL byte"));
    }

    #[test]
    fn atomic_write_creates_file_with_content() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("out.md");

        atomic_write(&path, "# Written\n").expect("write should succeed");

        assert_eq!(fs::read_to_string(&path).unwrap(), "# Written\n");
    }

    #[test]
    fn atomic_write_overwrites_existing_file_completely() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("out.md");
        fs::write(
            &path,
            "this is much longer old content that should be fully replaced",
        )
        .unwrap();

        atomic_write(&path, "short\n").expect("write should succeed");

        assert_eq!(fs::read_to_string(&path).unwrap(), "short\n");
    }

    #[test]
    fn save_file_rejects_invalid_content_without_touching_disk() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("out.md");
        fs::write(&path, "original\n").unwrap();

        let result = save_file(
            path.to_string_lossy().into_owned(),
            "bad\0content".to_string(),
        );

        assert!(result.is_err());
        // Original content must be untouched.
        assert_eq!(fs::read_to_string(&path).unwrap(), "original\n");
    }
}
