import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DiagramPanel from '../DiagramPanel';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

// Stand in for tldraw's <Tldraw> component: real tldraw needs a canvas/WebGL
// context jsdom doesn't provide. We only need `onMount` to fire with an
// object shaped enough to drive the component's insert flow.
let currentShapeIds: Set<string>;
let toImageMock: ReturnType<typeof vi.fn>;

vi.mock('tldraw', () => ({
  Tldraw: ({ onMount }: { onMount: (editor: unknown) => void }) => {
    const fakeEditor = {
      getCurrentPageShapeIds: () => currentShapeIds,
      toImage: toImageMock,
    };
    onMount(fakeEditor);
    return <div data-testid="tldraw-stub" />;
  },
}));

vi.mock('tldraw/tldraw.css', () => ({}));

function makeFakeBlob(bytes: number[]) {
  return {
    arrayBuffer: async () => new Uint8Array(bytes).buffer,
  };
}

describe('DiagramPanel', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    currentShapeIds = new Set();
    toImageMock = vi.fn();
  });

  it('shows an error and does not call invoke if nothing was drawn', async () => {
    const onInsert = vi.fn();
    render(<DiagramPanel onInsert={onInsert} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Insert diagram' }));

    expect(await screen.findByText('Draw something before inserting.')).toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalled();
    expect(onInsert).not.toHaveBeenCalled();
  });

  it('encodes the flattened image and calls onInsert with the returned path', async () => {
    currentShapeIds = new Set(['shape:1']);
    toImageMock.mockResolvedValue({ blob: makeFakeBlob([1, 2, 3]) });
    invokeMock.mockResolvedValue('/tmp/diagrams/abc.png');

    const onInsert = vi.fn();
    render(<DiagramPanel onInsert={onInsert} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Insert diagram' }));

    await waitFor(() => expect(onInsert).toHaveBeenCalledWith('/tmp/diagrams/abc.png'));
    expect(invokeMock).toHaveBeenCalledWith('save_diagram', { pngBase64: expect.any(String) });
  });

  it('shows an error if the save command rejects', async () => {
    currentShapeIds = new Set(['shape:1']);
    toImageMock.mockResolvedValue({ blob: makeFakeBlob([1, 2, 3]) });
    invokeMock.mockRejectedValue(new Error('disk full'));

    render(<DiagramPanel onInsert={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Insert diagram' }));

    expect(await screen.findByText('disk full')).toBeInTheDocument();
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(<DiagramPanel onInsert={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
