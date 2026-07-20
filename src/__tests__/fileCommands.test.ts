import { describe, expect, it, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn();
const convertFileSrcMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  convertFileSrc: (...args: unknown[]) => convertFileSrcMock(...args),
}));

const {
  openFile,
  saveFile,
  getRecentFiles,
  addRecentFile,
  getPreferences,
  setPreferences,
  diagramImageSrc,
} = await import('../fileCommands');

describe('fileCommands', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    convertFileSrcMock.mockReset();
  });

  it('openFile passes the given path and maps the raw response', async () => {
    invokeMock.mockResolvedValue({ path: '/tmp/a.md', content: '# Hi', modified_at: 123 });

    const result = await openFile('/tmp/a.md');

    expect(invokeMock).toHaveBeenCalledWith('open_file', { path: '/tmp/a.md' });
    expect(result).toEqual({ path: '/tmp/a.md', content: '# Hi', modifiedAt: 123 });
  });

  it('openFile passes null when no path given, for the native-dialog path', async () => {
    invokeMock.mockResolvedValue({ path: '/tmp/b.md', content: 'x', modified_at: 1 });

    await openFile();

    expect(invokeMock).toHaveBeenCalledWith('open_file', { path: null });
  });

  it('saveFile passes path and content', async () => {
    invokeMock.mockResolvedValue(undefined);

    await saveFile('/tmp/a.md', '# Content');

    expect(invokeMock).toHaveBeenCalledWith('save_file', {
      path: '/tmp/a.md',
      content: '# Content',
    });
  });

  it('getRecentFiles returns the raw array', async () => {
    invokeMock.mockResolvedValue(['/tmp/a.md', '/tmp/b.md']);

    const result = await getRecentFiles();

    expect(invokeMock).toHaveBeenCalledWith('get_recent_files');
    expect(result).toEqual(['/tmp/a.md', '/tmp/b.md']);
  });

  it('addRecentFile passes the path', async () => {
    invokeMock.mockResolvedValue(undefined);

    await addRecentFile('/tmp/a.md');

    expect(invokeMock).toHaveBeenCalledWith('add_recent_file', { path: '/tmp/a.md' });
  });

  it('getPreferences maps snake_case fields to camelCase', async () => {
    invokeMock.mockResolvedValue({
      theme: 'dark',
      focus_mode_default: true,
      autosave_interval_secs: 5,
    });

    const result = await getPreferences();

    expect(result).toEqual({ theme: 'dark', focusModeDefault: true, autosaveIntervalSecs: 5 });
  });

  it('setPreferences maps camelCase fields back to snake_case', async () => {
    invokeMock.mockResolvedValue(undefined);

    await setPreferences({ theme: 'light', focusModeDefault: false, autosaveIntervalSecs: 10 });

    expect(invokeMock).toHaveBeenCalledWith('set_preferences', {
      preferences: { theme: 'light', focus_mode_default: false, autosave_interval_secs: 10 },
    });
  });

  it('diagramImageSrc converts a raw filesystem path via the asset protocol', () => {
    convertFileSrcMock.mockReturnValue('asset://localhost/tmp/diagrams/fake.png');

    const result = diagramImageSrc('/tmp/diagrams/fake.png');

    expect(convertFileSrcMock).toHaveBeenCalledWith('/tmp/diagrams/fake.png');
    expect(result).toBe('asset://localhost/tmp/diagrams/fake.png');
  });
});
