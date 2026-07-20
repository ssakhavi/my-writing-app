import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import MilkdownEditor, { type MilkdownEditorHandle } from '../MilkdownEditor';

describe('MilkdownEditor', () => {
  it('mounts and renders the initial markdown', async () => {
    const { container } = render(<MilkdownEditor initialMarkdown="# Hello there" />);

    await waitFor(() => {
      expect(container.textContent).toContain('Hello there');
    });
  });

  it('exposes getMarkdown() via ref, reflecting the initial content', async () => {
    const ref = createRef<MilkdownEditorHandle>();
    render(<MilkdownEditor ref={ref} initialMarkdown="Some **bold** text.\n" />);

    await waitFor(() => {
      expect(ref.current?.getMarkdown()).toContain('bold');
    });
  });

  it('insertMarkdown() inserts content and fires onMarkdownChange', async () => {
    const ref = createRef<MilkdownEditorHandle>();
    const onMarkdownChange = vi.fn();
    render(
      <MilkdownEditor ref={ref} initialMarkdown="Start.\n" onMarkdownChange={onMarkdownChange} />,
    );

    await waitFor(() => {
      expect(ref.current?.getMarkdown()).toContain('Start');
    });

    ref.current?.insertMarkdown('![a diagram](https://example.com/x.png)');

    await waitFor(() => {
      expect(onMarkdownChange).toHaveBeenCalled();
    });
    const calls = onMarkdownChange.mock.calls;
    const lastCallMarkdown = calls[calls.length - 1]?.[0] as string;
    expect(lastCallMarkdown).toContain('![a diagram](https://example.com/x.png)');
  });

  it('does not throw on unmount right after mounting', async () => {
    const { unmount } = render(<MilkdownEditor initialMarkdown="# Bye\n" />);
    // Give Crepe a tick to start creating before we tear it down.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(() => unmount()).not.toThrow();
  });
});
