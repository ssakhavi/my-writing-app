import { useEffect, useRef } from 'react';
import { Crepe } from '@milkdown/crepe';
import '@milkdown/crepe/theme/classic.css';

interface MilkdownSpikeProps {
  onClose: () => void;
}

const SAMPLE = `# Milkdown engine spike

This is throwaway spike code (see \`docs/typora-clone-tasks.md\`, Phase 0.5)
for manually eyeballing what the automated round-trip test can't check: does
this actually *feel* like a WYSIWYG editor, and does typing stay smooth?

## Try it

- Type here, live
- Make a **bold** word, an *italic* one, and ~~strike~~ something
- [ ] Check this task off
- [x] This one's already done

1. Ordered
2. Lists
3. Too

> A blockquote, for good measure.

| Try | Table | Editing |
| --- | --- | --- |
| Add | a | row |
| Add | a | column |

\`\`\`js
// Fenced code block
const spike = true;
\`\`\`

Inline math: $E = mc^2$

$$
\\int_0^1 x^2 \\, dx = \\frac{1}{3}
$$

---

**What to check manually** (not automatable without a real browser):
1. Does formatting apply live as you type, with no flicker/lag?
2. Can you add/remove table rows and columns from the UI?
3. Type several paragraphs — does typing stay smooth on a longer document?
`;

/**
 * Manual-verification spike, not production UI. Automated coverage for
 * *serialization correctness* lives in
 * src/__tests__/milkdown-roundtrip.test.ts — jsdom can't render real
 * contenteditable/typing behavior, so live-rendering feel, table-editing
 * UX, and scroll behavior need a human looking at a real window
 * (`npm run tauri dev`).
 */
export default function MilkdownSpike({ onClose }: MilkdownSpikeProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const crepe = new Crepe({
      root,
      defaultValue: SAMPLE,
      // ImageBlock's default alt-text handling loses real alt text (it
      // repurposes the field as a resize ratio) — see the round-trip test
      // for details. Disabled here to match the configuration the
      // round-trip test actually verified.
      features: { [Crepe.Feature.ImageBlock]: false },
    });

    let cancelled = false;
    crepe.create().catch((err) => {
      if (!cancelled) {
        console.error('Milkdown spike failed to mount:', err);
      }
    });

    return () => {
      cancelled = true;
      crepe.destroy().catch(() => {});
    };
  }, []);

  return (
    <div className="milkdown-spike" role="dialog" aria-label="Milkdown engine spike">
      <div className="milkdown-spike__toolbar">
        <span className="milkdown-spike__title">Milkdown engine spike (Phase 0.5)</span>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="milkdown-spike__editor" ref={rootRef} />
    </div>
  );
}
