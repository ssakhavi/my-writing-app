import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Crepe } from '@milkdown/crepe';
import { commandsCtx } from '@milkdown/kit/core';
import { insert } from '@milkdown/kit/utils';
import {
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleStrongCommand,
} from '@milkdown/kit/preset/commonmark';
import { toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm';
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
  /** Called when the "Diagram" slash-menu item is chosen; opens the
   * tldraw diagram panel. Read through a ref (see below) so the Crepe
   * instance — created once on mount — always calls the latest handler. */
  onOpenDiagramPanel?: () => void;
}

// Minimalist single-glyph icons for the custom slash-menu formatting items,
// styled to match Crepe's bundled 24x24 stroke icons.
const boldIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>`;
const italicIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>`;
const strikethroughIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><path d="M16 6.5C15.5 5 14 4 12 4c-2.5 0-4.5 1.5-4.5 3.5 0 1.5 1 2.3 2.5 2.7"/><path d="M8 17.5c.5 1.5 2 2.5 4 2.5 2.5 0 4.5-1.5 4.5-3.5 0-1.5-1-2.3-2.5-2.7"/></svg>`;
const inlineCodeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
const diagramIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="5" rx="1"/><rect x="14" y="16" width="7" height="5" rx="1"/><path d="M6.5 8v4a2 2 0 0 0 2 2h4a2 2 0 0 1 2 2v0"/></svg>`;

/**
 * Production Milkdown/Crepe editor. `ImageBlock` is disabled: Crepe's
 * default image-block feature repurposes the markdown `alt` attribute as an
 * internal resize ratio and discards real alt text — see the Phase 0.5
 * round-trip test (src/__tests__/milkdown-roundtrip.test.ts) and
 * docs/typora-clone-tech-research.md for the full writeup.
 */
const MilkdownEditor = forwardRef<MilkdownEditorHandle, MilkdownEditorProps>(
  function MilkdownEditor({ initialMarkdown, onMarkdownChange, onOpenDiagramPanel }, ref) {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const crepeRef = useRef<Crepe | null>(null);
    // Crepe mounts once (see the empty deps array below); this ref lets its
    // slash-menu "Diagram" item always call the latest onOpenDiagramPanel
    // without needing to remount the editor when the prop identity changes.
    const onOpenDiagramPanelRef = useRef(onOpenDiagramPanel);
    onOpenDiagramPanelRef.current = onOpenDiagramPanel;

    useEffect(() => {
      const root = rootRef.current;
      if (!root) return;

      const crepe = new Crepe({
        root,
        defaultValue: initialMarkdown,
        features: { [Crepe.Feature.ImageBlock]: false },
        featureConfigs: {
          [Crepe.Feature.BlockEdit]: {
            // "Divider" (horizontal rule) isn't a construct this app
            // supports elsewhere yet; drop it from the slash menu.
            textGroup: { divider: null },
            // Crepe's default groups (text/list/advanced) are already built
            // by the time buildMenu runs, so this only adds to them.
            buildMenu: (builder) => {
              const format = builder.addGroup('format', 'Format');
              format.addItem('bold', {
                label: 'Bold',
                icon: boldIcon,
                onRun: (ctx) => {
                  ctx.get(commandsCtx).call(toggleStrongCommand.key);
                },
              });
              format.addItem('italic', {
                label: 'Italic',
                icon: italicIcon,
                onRun: (ctx) => {
                  ctx.get(commandsCtx).call(toggleEmphasisCommand.key);
                },
              });
              format.addItem('strikethrough', {
                label: 'Strikethrough',
                icon: strikethroughIcon,
                onRun: (ctx) => {
                  ctx.get(commandsCtx).call(toggleStrikethroughCommand.key);
                },
              });
              format.addItem('inline-code', {
                label: 'Inline Code',
                icon: inlineCodeIcon,
                onRun: (ctx) => {
                  ctx.get(commandsCtx).call(toggleInlineCodeCommand.key);
                },
              });

              const advanced = builder.getGroup('advanced');
              advanced.addItem('diagram', {
                label: 'Diagram',
                icon: diagramIcon,
                onRun: () => {
                  onOpenDiagramPanelRef.current?.();
                },
              });
            },
          },
        },
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
