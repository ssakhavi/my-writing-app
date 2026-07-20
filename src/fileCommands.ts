// Thin typed wrappers around the Rust file-I/O, recent-files, and
// preferences commands (src-tauri/src/file_io.rs, recent_files.rs,
// preferences.rs). Kept as plain functions rather than a class/hook so
// they're trivial to mock in component tests the same way DiagramPanel's
// `invoke` calls are mocked.
import { invoke } from '@tauri-apps/api/core';

export interface OpenedFile {
  path: string;
  content: string;
  modifiedAt: number;
}

interface OpenedFileRaw {
  path: string;
  content: string;
  modified_at: number;
}

/** Opens `path`, or shows a native "open file" dialog if omitted. */
export async function openFile(path?: string): Promise<OpenedFile> {
  const raw = await invoke<OpenedFileRaw>('open_file', { path: path ?? null });
  return { path: raw.path, content: raw.content, modifiedAt: raw.modified_at };
}

/** Validates and atomically writes `content` to `path`. */
export async function saveFile(path: string, content: string): Promise<void> {
  await invoke('save_file', { path, content });
}

export async function getRecentFiles(): Promise<string[]> {
  return invoke<string[]>('get_recent_files');
}

export async function addRecentFile(path: string): Promise<void> {
  await invoke('add_recent_file', { path });
}

export type Theme = 'light' | 'dark';

export interface Preferences {
  theme: Theme;
  focusModeDefault: boolean;
  autosaveIntervalSecs: number;
}

interface PreferencesRaw {
  theme: Theme;
  focus_mode_default: boolean;
  autosave_interval_secs: number;
}

export async function getPreferences(): Promise<Preferences> {
  const raw = await invoke<PreferencesRaw>('get_preferences');
  return {
    theme: raw.theme,
    focusModeDefault: raw.focus_mode_default,
    autosaveIntervalSecs: raw.autosave_interval_secs,
  };
}

export async function setPreferences(preferences: Preferences): Promise<void> {
  const raw: PreferencesRaw = {
    theme: preferences.theme,
    focus_mode_default: preferences.focusModeDefault,
    autosave_interval_secs: preferences.autosaveIntervalSecs,
  };
  await invoke('set_preferences', { preferences: raw });
}
