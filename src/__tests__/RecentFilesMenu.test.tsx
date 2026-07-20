import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RecentFilesMenu from '../RecentFilesMenu';

describe('RecentFilesMenu', () => {
  it('renders nothing when there are no recent files', () => {
    const { container } = render(<RecentFilesMenu paths={[]} onSelect={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('does not show the list until the Recent button is clicked', () => {
    render(<RecentFilesMenu paths={['/tmp/a.md']} onSelect={vi.fn()} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows basenames of each recent path after opening', () => {
    render(<RecentFilesMenu paths={['/tmp/notes/a.md', '/tmp/b.md']} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Recent' }));

    expect(screen.getByRole('button', { name: 'a.md' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'b.md' })).toBeInTheDocument();
  });

  it('calls onSelect with the full path and closes the list', () => {
    const onSelect = vi.fn();
    render(<RecentFilesMenu paths={['/tmp/notes/a.md']} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Recent' }));
    fireEvent.click(screen.getByRole('button', { name: 'a.md' }));

    expect(onSelect).toHaveBeenCalledWith('/tmp/notes/a.md');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
