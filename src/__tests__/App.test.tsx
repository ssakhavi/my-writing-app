import { forwardRef, useImperativeHandle } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
// App wires the ref correctly, so stub it with a fake imperative handle we
// can spy on.
const insertMarkdown = vi.fn();
vi.mock('../MilkdownEditor', () => ({
  default: forwardRef<MilkdownEditorHandle, { initialMarkdown: string }>(function StubEditor(
    { initialMarkdown },
    ref,
  ) {
    useImperativeHandle(ref, () => ({
      insertMarkdown,
      getMarkdown: () => initialMarkdown,
    }));
    return <div data-testid="milkdown-editor-stub" />;
  }),
}));

describe('App', () => {
  it('renders the editor and does not show the diagram panel initially', () => {
    render(<App />);
    expect(screen.getByTestId('milkdown-editor-stub')).toBeInTheDocument();
    expect(screen.queryByTestId('diagram-panel-stub')).not.toBeInTheDocument();
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
    insertMarkdown.mockClear();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Draw diagram' }));
    fireEvent.click(screen.getByRole('button', { name: 'stub-insert' }));

    expect(insertMarkdown).toHaveBeenCalledWith('![diagram](/tmp/diagrams/fake.png)');
    expect(screen.queryByTestId('diagram-panel-stub')).not.toBeInTheDocument();
  });
});
