import { useCallback, useRef, useState } from 'react';
import DiagramPanel from './DiagramPanel';
import MilkdownSpike from './spike/MilkdownSpike';

const PLACEHOLDER = `# Untitled

Start writing here. This plain-text view is a temporary stand-in until the
Milkdown WYSIWYG editor is built (see docs/typora-clone-tasks.md) — for now
it's enough to host the tldraw diagram panel.

Use "Draw diagram" to sketch something and insert it as an image.
`;

export default function App() {
  const [markdown, setMarkdown] = useState(PLACEHOLDER);
  const [isDrawingOpen, setIsDrawingOpen] = useState(false);
  const [isSpikeOpen, setIsSpikeOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const openDrawing = useCallback(() => setIsDrawingOpen(true), []);
  const closeDrawing = useCallback(() => setIsDrawingOpen(false), []);
  const openSpike = useCallback(() => setIsSpikeOpen(true), []);
  const closeSpike = useCallback(() => setIsSpikeOpen(false), []);

  const handleInsert = useCallback((imagePath: string) => {
    const textarea = textareaRef.current;
    const snippet = `![diagram](${imagePath})\n`;

    setMarkdown((prev) => {
      if (!textarea) return prev + '\n' + snippet;
      const start = textarea.selectionStart ?? prev.length;
      const end = textarea.selectionEnd ?? prev.length;
      return prev.slice(0, start) + snippet + prev.slice(end);
    });
    setIsDrawingOpen(false);
  }, []);

  return (
    <main className="app-shell">
      <header className="app-toolbar">
        <span className="app-toolbar__title">typora-clone</span>
        <button type="button" onClick={openDrawing}>
          Draw diagram
        </button>
        <button type="button" onClick={openSpike}>
          Milkdown spike
        </button>
      </header>

      <textarea
        ref={textareaRef}
        className="app-editor"
        value={markdown}
        onChange={(e) => setMarkdown(e.target.value)}
        spellCheck={false}
      />

      {isDrawingOpen && <DiagramPanel onInsert={handleInsert} onCancel={closeDrawing} />}
      {isSpikeOpen && <MilkdownSpike onClose={closeSpike} />}
    </main>
  );
}
