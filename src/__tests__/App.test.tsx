import { forwardRef, useImperativeHandle } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import type { MilkdownEditorHandle } from '../MilkdownEditor';

// DiagramPanel pulls in tldraw, which needs a real canvas/WebGL context that
// jsdom doesn't provide. It has its own focused test suite
// (DiagramPanel.test.tsx) with tldraw mocked, so here we stub it out and
// only verify App's own responsibilities: opening/closing the panel and
// telling the editor to insert the returned image path.
vi.mock('../DiagramPanel', () => ({
  default: ({ onInsert, onCancel }: { onInsert: (path: string) => void; onCancel: () => void }) => (
    <div data-testid="diagram-panel-stub">
      <button type="button" onClick={() => onInsert('/tmp/diagrams/fake.png')}>
        stub-insert
      </button>
      <button type="button" onClick={onCancel}>
        stub-cancel
      </button>
    </div>
  ),
}));

// MilkdownEditor mounts a real Crepe instance — that behavior has its own
// focused test suite (MilkdownEditor.test.tsx). Here we only need to verify
// App wires the ref and remount-on-open behavior correctly.
const insertMarkdown = vi.fn();
const getMarkdown = vi.fn(() => 'edited content');
vi.mock('../MilkdownEditor', () => ({
  default: forwardRef<
    MilkdownEditorHandle,
    { initialMarkdown: string; onOpenDiagramPanel?: () => void }
  >(function StubEditor({ initialMarkdown, onOpenDiagramPanel }, ref) {
    useImperativeHandle(ref, () => ({
      insertMarkdown,
      getMarkdown,
    }));
    return (
      <div data-testid="milkdown-editor-stub">
        {initialMarkdown}
        {onOpenDiagramPanel && (
          <button type="button" onClick={onOpenDiagramPanel}>
            stub-slash-diagram
          </button>
        )}
      </div>
    );
  }),
}));

const openFile = vi.fn();
const saveFile = vi.fn();
const getRecentFiles = vi.fn();
const addRecentFile = vi.fn();
const getPreferences = vi.fn();
const diagramImageSrc = vi.fn((path: string) => path);
vi.mock('../fileCommands', () => ({
  openFile: (...args: unknown[]) => openFile(...args),
  saveFile: (...args: unknown[]) => saveFile(...args),
  getRecentFiles: () => getRecentFiles(),
  addRecentFile: (...args: unknown[]) => addRecentFile(...args),
  getPreferences: () => getPreferences(),
  diagramImageSrc: (path: string) => diagramImageSrc(path),
}));

describe('App', () => {
  beforeEach(() => {
    insertMarkdown.mockClear();
    getMarkdown.mockClear();
    openFile.mockReset();
    saveFile.mockReset();
    getRecentFiles.mockReset().mockResolvedValue([]);
    addRecentFile.mockReset().mockResolvedValue(undefined);
    getPreferences.mockReset().mockResolvedValue({
      theme: 'light',
      focusModeDefault: false,
      autosaveIntervalSecs: 10,
    });
    diagramImageSrc.mockReset().mockImplementation((path: string) => path);
  });

  it('renders the editor and does not show the diagram panel initially', () => {
    render(<App />);
    expect(screen.getByTestId('milkdown-editor-stub')).toBeInTheDocument();
    expect(screen.queryByTestId('diagram-panel-stub')).not.toBeInTheDocument();
  });

  it('loads recent files and preferences on mount', async () => {
    render(<App />);
    await waitFor(() => expect(getRecentFiles).toHaveBeenCalled());
    expect(getPreferences).toHaveBeenCalled();
  });

  it('opens the diagram panel when "Draw diagram" is clicked', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Draw diagram' }));
    expect(screen.getByTestId('diagram-panel-stub')).toBeInTheDocument();
  });

  it('closes the diagram panel on cancel', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Draw diagram' }));
    fireEvent.click(screen.getByRole('button', { name: 'stub-cancel' }));
    expect(screen.queryByTestId('diagram-panel-stub')).not.toBeInTheDocument();
  });

  it('tells the editor to insert the markdown image reference and closes the panel on insert', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Draw diagram' }));
    fireEvent.click(screen.getByRole('button', { name: 'stub-insert' }));

    // The raw path from save_diagram must go through diagramImageSrc
    // (Tauri's asset protocol) before it's usable as an <img src> — see
    // fileCommands.diagramImageSrc.
    expect(diagramImageSrc).toHaveBeenCalledWith('/tmp/diagrams/fake.png');
    expect(insertMarkdown).toHaveBeenCalledWith('![diagram](/tmp/diagrams/fake.png)');
    expect(screen.queryByTestId('diagram-panel-stub')).not.toBeInTheDocument();
  });

  it('opens the diagram panel when the slash menu’s "Diagram" item is chosen', () => {
    render(<App />);
    expect(screen.queryByTestId('diagram-panel-stub')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'stub-slash-diagram' }));

    expect(screen.getByTestId('diagram-panel-stub')).toBeInTheDocument();
  });

  it('Open button opens a file via dialog (no path), loads it, and records it as recent', async () => {
    openFile.mockResolvedValue({ path: '/tmp/notes/doc.md', content: '# Doc', modifiedAt: 1 });
    getRecentFiles.mockResolvedValueOnce([]).mockResolvedValueOnce(['/tmp/notes/doc.md']);

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    await waitFor(() => expect(openFile).toHaveBeenCalledWith(undefined));
    await waitFor(() => expect(addRecentFile).toHaveBeenCalledWith('/tmp/notes/doc.md'));
    await waitFor(() =>
      expect(screen.getByTestId('milkdown-editor-stub')).toHaveTextContent('# Doc'),
    );
    // The toolbar title should switch from the app name to the open file's name.
    await waitFor(() => expect(screen.getByText('doc.md')).toBeInTheDocument());
  });

  it('Save button saves the editor content to the currently open file', async () => {
    openFile.mockResolvedValue({ path: '/tmp/notes/doc.md', content: '# Doc', modifiedAt: 1 });
    saveFile.mockResolvedValue(undefined);

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(openFile).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(saveFile).toHaveBeenCalledWith('/tmp/notes/doc.md', 'edited content'),
    );
  });

  it('Save shows an error instead of calling saveFile when no file is open yet', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(saveFile).not.toHaveBeenCalled();
    expect(screen.getByText(/Open a file first/)).toBeInTheDocument();
  });

  it('selecting a recent file opens it', async () => {
    getRecentFiles.mockResolvedValue(['/tmp/notes/doc.md']);
    openFile.mockResolvedValue({ path: '/tmp/notes/doc.md', content: '# Doc', modifiedAt: 1 });

    render(<App />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Recent' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Recent' }));
    fireEvent.click(screen.getByRole('button', { name: 'doc.md' }));

    await waitFor(() => expect(openFile).toHaveBeenCalledWith('/tmp/notes/doc.md'));
  });
});
