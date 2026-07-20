import { useCallback, useRef, useState } from 'react';
import DiagramPanel from './DiagramPanel';
import MilkdownEditor, { type MilkdownEditorHandle } from './MilkdownEditor';

const INITIAL_MARKDOWN = `# Untitled

Start writing here.

Use "Draw diagram" to sketch something and insert it as an image.
`;

export default function App() {
  const [isDrawingOpen, setIsDrawingOpen] = useState(false);
  // Tracks the editor's current content for future save-path wiring
  // (Phase 1's save_file work); the editor itself is uncontrolled and owns
  // its own document state.
  const [, setMarkdown] = useState(INITIAL_MARKDOWN);
  const editorRef = useRef<MilkdownEditorHandle | null>(null);

  const openDrawing = useCallback(() => setIsDrawingOpen(true), []);
  const closeDrawing = useCallback(() => setIsDrawingOpen(false), []);

  const handleInsert = useCallback((imagePath: string) => {
    editorRef.current?.insertMarkdown(`![diagram](${imagePath})`);
    setIsDrawingOpen(false);
  }, []);

  return (
    <main className="app-shell">
      <header className="app-toolbar">
        <span className="app-toolbar__title">typora-clone</span>
        <button type="button" onClick={openDrawing}>
          Draw diagram
        </button>
      </header>

      <MilkdownEditor
        ref={editorRef}
        initialMarkdown={INITIAL_MARKDOWN}
        onMarkdownChange={setMarkdown}
      />

      {isDrawingOpen && <DiagramPanel onInsert={handleInsert} onCancel={closeDrawing} />}
    </main>
  );
}
