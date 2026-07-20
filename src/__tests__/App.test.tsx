import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';

// DiagramPanel pulls in tldraw, which needs a real canvas/WebGL context that
// jsdom doesn't provide. It has its own focused test suite
// (DiagramPanel.test.tsx) with tldraw mocked, so here we stub it out and
// only verify App's own responsibilities: opening/closing the panel and
// inserting the returned image path into the markdown text at the cursor.
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

describe('App', () => {
  it('does not show the diagram panel initially', () => {
    render(<App />);
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

  it('inserts the markdown image reference at the end and closes the panel on insert', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Draw diagram' }));
    fireEvent.click(screen.getByRole('button', { name: 'stub-insert' }));

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toContain('![diagram](/tmp/diagrams/fake.png)');
    expect(screen.queryByTestId('diagram-panel-stub')).not.toBeInTheDocument();
  });

  it('inserts the markdown image reference at the cursor position, not just the end', () => {
    render(<App />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: 'before|after' } });
    textarea.setSelectionRange(7, 7); // cursor right after "before|"

    fireEvent.click(screen.getByRole('button', { name: 'Draw diagram' }));
    fireEvent.click(screen.getByRole('button', { name: 'stub-insert' }));

    expect(textarea.value).toBe('before|![diagram](/tmp/diagrams/fake.png)\nafter');
  });
});
