import { useState } from 'react';

interface RecentFilesMenuProps {
  paths: string[];
  onSelect: (path: string) => void;
}

function basename(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

/** Toolbar dropdown listing recently-opened files (PRD: "a short
 * recent-files list (last 5–10 files)" — no persistent file-tree browser). */
export default function RecentFilesMenu({ paths, onSelect }: RecentFilesMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (paths.length === 0) {
    return null;
  }

  return (
    <div className="recent-files">
      <button type="button" onClick={() => setIsOpen((prev) => !prev)} aria-expanded={isOpen}>
        Recent
      </button>
      {isOpen && (
        <ul className="recent-files__list">
          {paths.map((path) => (
            <li key={path}>
              <button
                type="button"
                onClick={() => {
                  onSelect(path);
                  setIsOpen(false);
                }}
              >
                {basename(path)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
