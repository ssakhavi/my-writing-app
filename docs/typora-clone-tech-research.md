# Technology Landscape Research — Typora Clone

## Research Overview

**Methodology:** Web research across current documentation, benchmark write-ups, and comparison articles for each open technical question in the PRD.
**Research question:** Which specific libraries/frameworks should the app commit to for the app shell, the WYSIWYG editor core, syntax highlighting, and math rendering — given the constraints of offline-only, minimalist, distraction-free writing, and a Tauri + Rust backend?
**Timeframe:** July 2026.

## Key Findings

**1. Tauri v2 is the clear choice for the app shell over Electron.**
Tauri wraps the OS's native webview instead of bundling Chromium, producing dramatically smaller and lighter apps: benchmarks put Tauri 2.0 bundles around 5–12MB versus ~180MB for a comparable Electron app, with roughly 85MB RAM at launch versus 450MB, and cold-start around 1.8s versus 12s. This directly supports the PRD's sub-500ms cold-start goal and the minimalist/offline positioning. Tauri 2.0 also has stable mobile targets now, though that's out of scope per the PRD's non-goals.
Confidence: High — consistent across multiple independent 2026 benchmark sources.

**2. Milkdown is the strongest fit for the WYSIWYG editor core, not Tiptap.**
Milkdown is a plugin-based WYSIWYG markdown framework built on ProseMirror, purpose-built around markdown as the source of truth (not rich-text-with-markdown-export, which is Tiptap's model). It's lightweight (~40kb min+gzip) and highly customizable via plugins. Sources note it's the stronger choice specifically "if your product's core is markdown" — which matches this app exactly, versus Tiptap being oriented more toward general rich-text editing with markdown as one of several output formats.
Confidence: High for the architecture choice; Medium on specific plugin ecosystem maturity — worth a short prototype spike (already planned in the PRD) before fully committing, since Milkdown's React integration is described as "bare-bones," requiring manual UI construction. Given the app doesn't need React (Tauri frontend can be vanilla/Svelte/etc.), this is likely a non-issue but should be validated in the spike.

**3. A hybrid parsing model — Rust-side CommonMark/GFM parsing, JS-side WYSIWYG rendering — is achievable and idiomatic for Tauri apps.**
`pulldown-cmark` is a mature, actively maintained (2026: v0.13.1, supports CommonMark 0.31) Rust CommonMark parser supporting tables, task lists, strikethrough, footnotes, and LaTeX-style math extensions. This means round-trip validation (does saved markdown parse back to the same structure) can be done natively in the Rust layer, independent of whatever the frontend editor renders — giving a second, trustworthy source of truth for the "valid markdown on save" acceptance criterion in the PRD. `comrak` is a documented alternative if broader GFM compatibility is later needed.
Confidence: High.

**4. Shiki and highlight.js represent a real trade-off between visual quality and offline weight — highlight.js is the better default for this app.**
Shiki produces VS Code-quality highlighting using real TextMate grammars, but it ships a WASM dependency, weighs about a quarter-megabyte, and is reported as ~7x slower than Prism for client-side/runtime highlighting — it's designed for build-time/static rendering, not a live-typing editor. highlight.js is lighter, has no dependencies, and does automatic language detection, which fits a live WYSIWYG surface better where code blocks are being typed and re-highlighted continuously.
Confidence: Medium-High — the sources are consistent, but no source directly benchmarks either library inside a ProseMirror/Milkdown live-editing context specifically, so this should be spot-checked during the engine spike.

**5. KaTeX remains the right choice over MathJax for this app's constraints.**
KaTeX is synchronous, renders without page reflow, and has smaller bundle/font footprint than MathJax, which matters for a fast cold-start, offline-vendored app. MathJax 3 has closed much of the historical speed gap and offers broader LaTeX coverage, but that breadth isn't a requirement here (the PRD only asks for standard inline/block math). KaTeX was already the assumption in the PRD; research confirms it holds up.
Confidence: High.

**6. No source directly validates a production app combining Tauri + Milkdown + pulldown-cmark together** — this is a reasonable, individually-well-supported stack, but the specific integration (keeping Milkdown's in-editor document model and Rust's pulldown-cmark round-trip in sync) is not something existing comparison articles address. This is the single biggest technical risk in the stack and the core justification for doing a short spike before Phase 1, exactly as the PRD already proposes.
Confidence: Low (this is a gap, not a finding) — flagged as the top open risk.

## Opportunity Areas

- **Cold-start and minimalism goals are unusually well-served by the chosen stack** — Tauri's size/RAM/startup advantages aren't just nice-to-have, they're structurally aligned with the "distraction-free, fast-to-open" product goal in a way Electron couldn't match.
- **Rust-side markdown parsing as a safety net** — using `pulldown-cmark` independently of the editor's own serialization gives a cheap way to test the "document round-trips cleanly" P0 acceptance criterion without trusting the JS editor alone.
- **Syntax highlighting choice should be revisited if code blocks turn out to be a minor use case** — if, after the spike, code blocks are rare in actual writing sessions, it may be worth simplifying further (e.g., no live syntax highlighting while typing, apply highlighting only on blur/render) to keep the editor lightweight.

## Recommendations

1. **Commit to Tauri v2** as the app shell (already decided in the PRD; research strongly confirms this was the right call).
2. **Prototype Milkdown first** in the planned engine spike, specifically testing: live rendering of headings/lists/bold, table editing, and markdown round-trip fidelity against `pulldown-cmark` output. If Milkdown's plugin ecosystem proves too immature for tables or math during the spike, fall back to a CodeMirror 6 + markdown-it live-preview hybrid as a second option — but start with Milkdown given the stronger architectural fit.
3. **Use `pulldown-cmark` in the Rust layer** for validating/serializing markdown independently of the frontend editor, and as the parser for export (HTML/PDF generation).
4. **Default to highlight.js for in-editor syntax highlighting**, given the live-typing performance profile; consider Shiki only for a static "export to HTML" pass where build-time-style rendering is acceptable and quality matters more than runtime speed.
5. **Keep KaTeX** as already planned; no change indicated.
6. **Treat the Milkdown–pulldown-cmark integration as the highest-risk unknown** and make it the explicit success criterion of the spike phase, not just "does live rendering work."

## Open Questions (Updated from PRD)

- Milkdown vs. CodeMirror 6 + markdown-it: recommend starting with Milkdown per above; spike should produce a go/no-go decision, not just a demo. (engineering)
- Shiki vs. highlight.js: recommend highlight.js for the live editor; open question is whether a separate Shiki pass is worth the added complexity for export-only rendering, or whether highlight.js output is good enough for exported HTML/PDF too. (engineering)
- No comparable existing open-source project was found that combines this exact stack (Tauri + Milkdown + pulldown-cmark) — worth a quick search for prior art/reference implementations before the spike starts, to avoid rediscovering integration pitfalls others have already solved. (engineering)

## Addendum (2026-07-20): React added, scoped to the diagram panel only

Finding 2 above concluded the app "doesn't need React." That's revised, but narrowly: the app owner asked for a freeform tldraw drawing panel ahead of the Milkdown spike (see `typora-clone-tasks.md`, "Diagram support — tldraw drawing panel"), and tldraw's supported integration path is React. The frontend now bootstraps a React root (`src/main.tsx` → `src/App.tsx`) with the diagram panel as a component.

This does **not** change the Milkdown recommendation above — Milkdown/ProseMirror remain framework-agnostic and vanilla-first is still the plan for the editor core itself once Phase 1 starts. React's footprint here is limited to hosting the tldraw canvas and the (currently placeholder) textarea shell that predates the real editor. Revisit whether the eventual Milkdown integration should also mount through React (simpler, one root) or stay vanilla alongside it (smaller footprint, matches the original plan) once the Phase 0.5 engine spike happens.

## Addendum (2026-07-20): Phase 0.5 engine spike result — GO, plus one real finding

The spike (see `typora-clone-tasks.md`, Phase 0.5) confirms the recommendation above: Milkdown round-trips all P0 constructs correctly through `pulldown-cmark`, verified by a real cross-language automated test (`src/__tests__/milkdown-roundtrip.test.ts`), not just a demo. Specifically, we used `@milkdown/crepe`, Milkdown's official "batteries included" WYSIWYG package — it bundles the commonmark/gfm presets, table editing, code blocks, and a KaTeX-backed math feature out of the box, which is a better fit for this app's "minimal setup, maximal WYSIWYG" goal than assembling `@milkdown/kit` presets by hand.

One real bug/gotcha worth flagging for anyone extending the editor: Crepe's default `ImageBlock` feature (resizable block-level images) discards accessible alt text — it repurposes the markdown `alt` field internally as a resize ratio and writes a number like `1.00` back into it on serialize. This is invisible unless you specifically round-trip an image with alt text, which is exactly what the spike test did. Fix applied: disable `CrepeFeature.ImageBlock`; images fall back to inline handling, which preserves alt text correctly. Trade-off: you lose the built-in resize-handle UX for images. If that UX turns out to matter, the alternative is extending `image-block`'s ProseMirror schema with a real `alt` attribute alongside its existing `ratio`/`caption` attributes, rather than re-enabling the feature as-is.
