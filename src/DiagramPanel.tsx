import { useCallback, useRef, useState } from 'react';
import { Editor, Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';
import { invoke } from '@tauri-apps/api/core';

interface DiagramPanelProps {
  /** Called with the markdown-relative path of the saved diagram image. */
  onInsert: (imagePath: string) => void;
  onCancel: () => void;
}

/**
 * Full-screen modal hosting a tldraw canvas. The user draws freely, then
 * "Insert diagram" flattens the current page to a PNG, saves it via the
 * Rust `save_diagram` command, and hands the resulting file path back to
 * the caller to insert as a markdown image reference.
 */
export default function DiagramPanel({ onInsert, onCancel }: DiagramPanelProps) {
  const editorRef = useRef<Editor | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  const handleInsert = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;

    const shapeIds = editor.getCurrentPageShapeIds();
    if (shapeIds.size === 0) {
      setError('Draw something before inserting.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const { blob } = await editor.toImage([...shapeIds], {
        format: 'png',
        background: true,
        padding: 16,
      });
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuffer);
      const path = await invoke<string>('save_diagram', { pngBase64: base64 });
      onInsert(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save diagram.');
    } finally {
      setIsSaving(false);
    }
  }, [onInsert]);

  return (
    <div className="diagram-modal" role="dialog" aria-label="Draw a diagram">
      <div className="diagram-modal__toolbar">
        <span className="diagram-modal__title">Draw a diagram</span>
        {error && <span className="diagram-modal__error">{error}</span>}
        <div className="diagram-modal__actions">
          <button type="button" onClick={onCancel} disabled={isSaving}>
            Cancel
          </button>
          <button type="button" onClick={handleInsert} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Insert diagram'}
          </button>
        </div>
      </div>
      <div className="diagram-modal__canvas">
        <Tldraw onMount={handleMount} />
      </div>
    </div>
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
