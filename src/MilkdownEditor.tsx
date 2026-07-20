import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Crepe } from '@milkdown/crepe';
import { insert } from '@milkdown/kit/utils';
// theme/classic.css is color/font tokens only; theme/common/style.css has
// the actual structural styles (tables, hover-triggered block controls,
// etc.) — both are required, discovered the hard way during the Phase 0.5
// spike (see docs/typora-clone-tasks.md).
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/classic.css';

export interface MilkdownEditorHandle {
  /** Inserts markdown at the current cursor/selection. */
  insertMarkdown: (markdown: string) => void;
  /** Returns the editor's current content, serialized to markdown. */
  getMarkdown: () => string;
}

interface MilkdownEditorProps {
  /** Content the editor mounts with. Uncontrolled after mount — updating
   * this prop does not re-sync the editor; use the ref's `insertMarkdown`
   * for programmatic edits post-mount. */
  initialMarkdown: string;
  /** Called with the full serialized markdown on every doc change. */
  onMarkdownChange?: (markdown: string) => void;
}

/**
 * Production Milkdown/Crepe editor. `ImageBlock` is disabled: Crepe's
 * default image-block feature repurposes the markdown `alt` attribute as an
 * internal resize ratio and discards real alt text — see the Phase 0.5
 * round-trip test (src/__tests__/milkdown-roundtrip.test.ts) and
 * docs/typora-clone-tech-research.md for the full writeup.
 */
const MilkdownEditor = forwardRef<MilkdownEditorHandle, MilkdownEditorProps>(
  function MilkdownEditor({ initialMarkdown, onMarkdownChange }, ref) {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const crepeRef = useRef<Crepe | null>(null);

    useEffect(() => {
      const root = rootRef.current;
      if (!root) return;

      const crepe = new Crepe({
        root,
        defaultValue: initialMarkdown,
        features: { [Crepe.Feature.ImageBlock]: false },
      });

      if (onMarkdownChange) {
        crepe.on((listener) => {
          listener.markdownUpdated((_ctx, markdown) => {
            onMarkdownChange(markdown);
          });
        });
      }

      let cancelled = false;
      crepe
        .create()
        .then(() => {
          if (!cancelled) {
            crepeRef.current = crepe;
          }
        })
        .catch((err) => {
          if (!cancelled) {
            console.error('Milkdown editor failed to mount:', err);
          }
        });

      return () => {
        cancelled = true;
        crepeRef.current = null;
        crepe.destroy().catch(() => {});
      };
      // Mounts once with the initial value; this is an uncontrolled editor by
      // design (re-mounting Milkdown on every parent re-render would blow
      // away undo history and cursor position).
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        insertMarkdown: (markdown: string) => {
          crepeRef.current?.editor.action(insert(markdown));
        },
        getMarkdown: () => crepeRef.current?.getMarkdown() ?? '',
      }),
      [],
    );

    return <div className="milkdown-editor" ref={rootRef} />;
  },
);

export default MilkdownEditor;
