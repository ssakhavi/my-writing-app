import { useCallback, useEffect, useRef, useState } from 'react';
import DiagramPanel from './DiagramPanel';
import MilkdownEditor, { type MilkdownEditorHandle } from './MilkdownEditor';
import RecentFilesMenu from './RecentFilesMenu';
import {
  addRecentFile,
  getPreferences,
  getRecentFiles,
  openFile,
  saveFile,
  type Preferences,
} from './fileCommands';

const INITIAL_MARKDOWN = `# Untitled

Start writing here.

Use "Draw diagram" to sketch something and insert it as an image.
`;

export default function App() {
  const [isDrawingOpen, setIsDrawingOpen] = useState(false);
  // Tracks the editor's current content so Save has something to write;
  // the editor itself is uncontrolled and owns its own document state
  // between changes.
  const [markdown, setMarkdown] = useState(INITIAL_MARKDOWN);
  // What the editor mounts with. Bumping documentVersion forces
  // MilkdownEditor to remount (via `key`) with fresh content when a
  // different file is opened — the editor doesn't support swapping content
  // on an already-mounted instance.
  const [documentMarkdown, setDocumentMarkdown] = useState(INITIAL_MARKDOWN);
  const [documentVersion, setDocumentVersion] = useState(0);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Loaded on startup for future phases (theme/focus-mode application is
  // Phase 2 work); kept here now so preferences persistence has a real
  // frontend consumer, per Phase 1's "preferences persist and reload
  // correctly" requirement.
  const [, setPreferences] = useState<Preferences | null>(null);
  const editorRef = useRef<MilkdownEditorHandle | null>(null);

  useEffect(() => {
    getRecentFiles()
      .then(setRecentFiles)
      .catch((err) => console.error('Failed to load recent files:', err));
    getPreferences()
      .then(setPreferences)
      .catch((err) => console.error('Failed to load preferences:', err));
  }, []);

  const openDrawing = useCallback(() => setIsDrawingOpen(true), []);
  const closeDrawing = useCallback(() => setIsDrawingOpen(false), []);

  const handleInsert = useCallback((imagePath: string) => {
    editorRef.current?.insertMarkdown(`![diagram](${imagePath})`);
    setIsDrawingOpen(false);
  }, []);

  const loadFile = useCallback(async (path?: string) => {
    try {
      const opened = await openFile(path);
      setCurrentFilePath(opened.path);
      setDocumentMarkdown(opened.content);
      setDocumentVersion((v) => v + 1);
      setSaveError(null);
      await addRecentFile(opened.path);
      setRecentFiles(await getRecentFiles());
    } catch (err) {
      // A cancelled dialog rejects too; that's not an error worth
      // surfacing to the user.
      console.error('Failed to open file:', err);
    }
  }, []);

  const handleOpenClick = useCallback(() => {
    void loadFile();
  }, [loadFile]);

  const handleRecentSelect = useCallback(
    (path: string) => {
      void loadFile(path);
    },
    [loadFile],
  );

  const handleSaveClick = useCallback(() => {
    if (!currentFilePath) {
      setSaveError('Open a file first — creating new files isn’t wired up yet.');
      return;
    }
    const content = editorRef.current?.getMarkdown() ?? markdown;
    saveFile(currentFilePath, content)
      .then(() => setSaveError(null))
      .catch((err) => setSaveError(err instanceof Error ? err.message : String(err)));
  }, [currentFilePath, markdown]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSaveClick();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveClick]);

  return (
    <main className="app-shell">
      <header className="app-toolbar">
        <span className="app-toolbar__title">
          {currentFilePath ? currentFilePath.split(/[/\\]/).pop() : 'typora-clone'}
        </span>
        <button type="button" onClick={handleOpenClick}>
          Open
        </button>
        <button type="button" onClick={handleSaveClick}>
          Save
        </button>
        <RecentFilesMenu paths={recentFiles} onSelect={handleRecentSelect} />
        <button type="button" onClick={openDrawing}>
          Draw diagram
        </button>
        {saveError && <span className="app-toolbar__error">{saveError}</span>}
      </header>

      <MilkdownEditor
        key={documentVersion}
        ref={editorRef}
        initialMarkdown={documentMarkdown}
        onMarkdownChange={setMarkdown}
      />

      {isDrawingOpen && <DiagramPanel onInsert={handleInsert} onCancel={closeDrawing} />}
    </main>
  );
}
