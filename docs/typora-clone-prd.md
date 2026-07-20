# Typora Clone — Product Requirements Document

## Problem Statement

Existing markdown WYSIWYG editors either feel dated (Typora hasn't meaningfully modernized its rendering engine or editing internals in years) or force a split-pane source/preview workflow that breaks the "write in prose, see the result" flow. Most also drift toward becoming personal knowledge management (PKM) tools — backlinks, graphs, tagging systems — which adds UI chrome and cognitive overhead that works against sustained writing focus. The author wants a personal tool that does one thing well: help them write, uninterrupted, with markdown rendered live as they type. Fast to open, minimal on screen, true WYSIWYG (not split-preview), built on a modern markdown engine rather than the aging tech most clones use.

## Goals

1. Achieve true single-pane WYSIWYG editing — no source/preview split — for at least 95% of common markdown constructs (headings, lists, tables, code, math, links, images).
2. Minimize on-screen chrome so the writing surface is the dominant visual element at all times; support a distraction-free/focus mode with zero extra clicks to enter.
3. Cold-start to an editable document in under 500ms on a mid-range laptop.
4. Support fully offline use with zero network calls required for core editing, rendering, or export.
5. Ship with automated test coverage on the editor/rendering core and a green CI pipeline gating every merge to main.
6. Reach a personally-usable MVP (daily-driver replacement for existing writing tool) within a few weeks of part-time effort.

## Non-Goals

- **Personal knowledge management (PKM) features** — no backlinks, no graph view, no tagging/linking system, no daily-notes/journal scaffolding. This is a writing app, not a second brain; any feature that primarily serves organizing/connecting notes rather than writing them is out of scope.
- **Real-time collaboration / multi-user editing** — adds sync-engine complexity disproportionate to a single-user tool; can be revisited later.
- **Plugin/extension marketplace** — a public extension API is a v2+ concern; v1 ships with fixed built-in functionality.
- **Mobile apps (iOS/Android)** — Tauri's mobile targets are less mature; desktop-only keeps scope tight.
- **Cloud sync / account system** — conflicts with the offline-only constraint and isn't needed for a single local user.
- **Custom markdown dialect / non-standard syntax extensions** — stick to CommonMark + GFM + math, to keep the parser swappable and the files portable.

## User Stories

- As the sole user, I want to type markdown and see it rendered as formatted text immediately (bold, headings, lists rendering live) so that I never have to context-switch to a preview pane or think about syntax.
- As the sole user, I want a focus/distraction-free mode that hides all chrome (menus, sidebars, toolbars) so that only my writing is on screen.
- As the sole user, I want typewriter scrolling (current line stays vertically centered) and optional sentence/paragraph dimming (focus the current line, mute the rest) so that my eyes stay locked on where I'm writing.
- As the sole user, I want to open a single file quickly (via a minimal open dialog or recent-files list) without being routed through a heavy file-browsing UI, so that opening the app and starting to write has as little friction as possible.
- As the sole user, I want tables, fenced code blocks with syntax highlighting, and math (KaTeX) to render inline so that technical notes look correct without extra tooling.
- As the sole user, I want to type `/` to open a slash-command menu for inserting elements (footnotes, subscript, superscript, tables, code blocks, math, etc.) so that I can insert less-common constructs without memorizing hotkeys or reaching for a mouse-driven menu.
- As the sole user, I want to switch between a few built-in themes (at least one light, one dark) so that the app matches my environment and reduces eye strain.
- As the sole user, I want to export the current document to PDF or HTML so that I can share what I wrote outside the app.
- As the sole user, I want the app to work with no internet connection so that it's reliable regardless of network state.
- As the sole user, I want unsaved changes to be preserved (autosave or crash recovery) so that I don't lose work if the app closes unexpectedly.
- As the sole user, I want long documents (a few thousand lines) to stay responsive so that the editor doesn't stutter and break my flow.

## Requirements

### Must-Have (P0)

**Tauri + Rust shell**
- App is packaged with Tauri (Rust backend, native webview frontend).
- Acceptance: app builds and launches as a native binary on macOS (primary dev target); file-system access goes through Tauri's Rust commands, not raw browser APIs.

**Modern WYSIWYG markdown editor core**
- Single-pane editing where markdown syntax is rendered live as formatted content (e.g., `# ` becomes a heading as you type, not shown as raw characters), backed by a modern engine — evaluate Milkdown (ProseMirror + remark/unified) as the primary candidate, since it's an actively maintained, plugin-based WYSIWYG markdown framework built on current parsing standards.
- Acceptance: typing standard CommonMark + GFM syntax produces correctly rendered output with no visible raw markdown tokens for supported constructs; underlying document remains valid markdown when saved to disk (round-trips cleanly).

**Core markdown feature support**
- Headings, bold/italic/strikethrough, ordered/unordered/task lists, blockquotes, links, images, horizontal rules.
- Tables with add/remove row/column via UI.
- Fenced code blocks with syntax highlighting for common languages.
- Math via KaTeX (inline `$...$` and block `$$...$$`).
- Extended GFM-family constructs: footnotes, subscript, superscript, definition lists, and abbreviations.
- Acceptance: each construct has a passing test asserting correct render and correct markdown serialization on save.

**Slash-command menu for element insertion**
- Typing `/` at the start of a line (or after whitespace) opens a filterable inline menu listing every insertable construct — all core and extended constructs above (headings, lists, tables, code blocks, math, footnotes, subscript, superscript, definition lists, abbreviations, images, horizontal rules, etc.) — so any element can be inserted without a hotkey or the mouse.
- Menu is keyboard-navigable (arrow keys + Enter to select, Escape to dismiss) and filters as the user keeps typing after `/`.
- Selecting an item inserts the construct at the cursor (e.g., a footnote reference + its definition slot, a subscript/superscript inline mark, a table skeleton) and leaves the cursor in the correct spot to keep typing.
- Acceptance: every construct listed in "Core markdown feature support" and its extended GFM-family additions is reachable via the slash menu; each has a passing test asserting the menu inserts the correct markdown-equivalent structure at the correct cursor position.

**Minimal file open, not a browser**
- Open a single `.md` file via native open dialog or a short recent-files list (last 5–10 files). No persistent sidebar file tree, no folder-scoped workspace — this is a writing surface, not a notes browser.
- Acceptance: launching the app and opening a file takes no more than one dialog interaction; the UI has no always-visible file/folder navigation panel.

**Focus / distraction-free mode**
- A toggle (keyboard shortcut, e.g. Cmd+.) that hides all UI chrome — menu bar overlays, toolbars, window furniture where the OS allows — leaving only the document text, full window/fullscreen.
- Typewriter scrolling: the active line stays vertically centered as the user types.
- Optional paragraph/sentence focus: dim all text except the current paragraph (or sentence), toggleable independently of fullscreen focus mode.
- Acceptance: entering focus mode is a single shortcut with no confirmation step; typewriter scrolling keeps the cursor within a fixed vertical band during continuous typing; focus-mode and dimming states persist per-session.

**Local file persistence**
- Open, edit, and save `.md` files directly to disk via Tauri filesystem APIs. No cloud dependency.
- Acceptance: save writes valid UTF-8 markdown matching what's rendered; app recovers unsaved changes after a crash (autosave to a recovery buffer at a defined interval, e.g. every 5–10s or on pause in typing).

**Themes**
- At least one light and one dark built-in theme, switchable from a settings/menu.
- Acceptance: theme choice persists across restarts; switching themes doesn't require reload of the open document.

**Export**
- Export current document to PDF and to standalone HTML.
- Acceptance: exported PDF/HTML visually matches the in-app rendering for all P0 markdown constructs, including math and syntax-highlighted code.

**Offline-only operation**
- No network requests required for editing, rendering, saving, or exporting. Any bundled fonts/libraries (KaTeX, highlighter) are vendored, not fetched from a CDN at runtime.
- Acceptance: app functions correctly with network access disabled at the OS level.

**Testing — test-driven development (strict requirement)**
- All implementation work follows TDD: a failing test is written before the corresponding implementation code, for both the Rust backend (file I/O, markdown validation/round-trip, export) and the frontend editor logic.
- Unit tests for markdown parse/serialize round-tripping and for the Rust filesystem commands.
- Component/integration tests for the editor covering each P0 construct.
- Acceptance: test suite runs in CI; coverage reported for the editor core and Rust command layer; PR review checks that tests were introduced alongside (and not after) the code they cover.

**CI/CD on GitHub (strict requirement)**
- GitHub repository with GitHub Actions running as separate, independently-failing checks on every PR and push to main:
  - Formatting check (`rustfmt --check` for Rust; `prettier --check` or equivalent for frontend) — fails the build if code is not correctly formatted, does not auto-fix.
  - Linting check (`clippy` for Rust; `eslint` or equivalent for frontend) — fails the build on lint errors.
  - Test suite (unit + integration, both Rust and frontend).
- Build pipeline that produces a packaged app artifact (at least for macOS) on tagged releases.
- Acceptance: PRs are blocked from merging unless formatting, linting, and tests all pass as distinct required checks; a tagged release produces a downloadable build artifact.

**Documentation**
- README covering setup, build, and run instructions.
- Architecture doc describing the editor engine choice, Tauri command boundary, and file format handling.
- Acceptance: a new contributor can clone the repo and get a running dev build using only the README.

### Nice-to-Have (P1)

- Command palette (Cmd+K-style, separate from the P0 slash-command menu) for keyboard-shortcut-driven formatting and app-level actions beyond basic OS shortcuts.
- Word/character count and a session writing timer, shown only on demand (not persistent chrome).
- Find and replace within a document.
- Configurable autosave interval.
- Ambient/soundscape or "do not disturb" OS integration (e.g., silence notifications while in focus mode).
- Windows and Linux packaged builds (in addition to macOS).

### Future Considerations (P2)

- Custom theme editor / user-defined CSS.
- Extension or plugin system for custom renderers or export targets.
- Multi-window / multi-document support.
- Sync via user-provided storage (e.g., a folder the user syncs themselves with Dropbox/iCloud) — still offline-only from the app's perspective, but worth designing the file-watching layer so it doesn't break under external sync tools.
- Outline/table-of-contents navigation for a single long document — deliberately deferred since it edges toward document-organizing rather than writing, and isn't needed until documents get long enough to warrant it.

## Success Metrics

Since this is a single-user personal tool, success is primarily self-assessed rather than analytics-driven.

**Leading indicators**
- Cold-start time: target under 500ms, measured locally on the dev machine.
- Editor responsiveness: no perceptible input lag (target <16ms per keystroke render) on documents up to ~5,000 lines.
- CI pass rate: green build on main at all times; target 100% of merged PRs pass CI.

**Lagging indicators**
- Daily-driver adoption: the author actually uses this app instead of their current notes tool within 30 days of reaching MVP (self-reported, binary).
- Defect rate: number of data-loss or rendering-corruption bugs found in the first month of personal use (target: zero data-loss incidents).

## Open Questions

- **[Resolved, pending spike validation]** Markdown engine: research (see `typora-clone-tech-research.md`) recommends **Milkdown** (ProseMirror-based) as the primary candidate over Tiptap or CodeMirror 6 + markdown-it, since it's purpose-built around markdown-as-source-of-truth rather than rich-text-with-markdown-export. The Phase 0 spike should treat the Milkdown ↔ Rust round-trip integration as its explicit go/no-go criterion, not just live-rendering fidelity — no existing reference project was found combining this exact stack, so it's the top technical risk. (engineering)
- **[Resolved, pending spike validation]** Syntax highlighting: recommend **highlight.js** as the default for live in-editor highlighting (lighter, faster at runtime) rather than Shiki (higher fidelity but ~7x slower at runtime, designed for build-time rendering). Open sub-question: is a separate Shiki pass worth it for export-only HTML/PDF rendering, or is highlight.js output good enough there too? (engineering)
- Target OS scope for v1 builds — macOS-only first, or build the CI matrix for Windows/Linux from day one even if not personally used? (engineering, informed by author preference)
- Autosave/crash-recovery mechanism — write-ahead buffer file vs. in-memory + periodic disk flush? Affects data-loss guarantees. (engineering)
- Repository visibility (public vs. private on GitHub) — affects whether CI secrets/setup need to account for external contributors. (author)

See `typora-clone-tech-research.md` for the full technology landscape research backing the above, including confirmation that Tauri v2 (~5–12MB bundles, ~85MB RAM, ~1.8s cold start) is well-suited to the cold-start and minimalism goals versus Electron, that `pulldown-cmark` is a solid Rust-side CommonMark/GFM parser for independent round-trip validation and export, and that KaTeX remains the right math-rendering choice over MathJax.

## Timeline Considerations

- No hard deadline; side-project pace.
- Target: usable MVP (P0 scope) within a few weeks of part-time effort.
- Suggested phasing:
  1. **Spike (few days):** validate markdown engine choice with a throwaway prototype covering live rendering of headings/lists/bold before committing to the architecture.
  2. **Phase 1 (P0 core):** Tauri shell, file tree, open/save, basic WYSIWYG editing (text formatting, lists, links) with tests and CI scaffolding in place from the start.
  3. **Phase 2 (P0 completion):** tables, code blocks with highlighting, math, themes, export, autosave/crash recovery.
  4. **Phase 3 (P1 polish):** command palette, outline sidebar, find/replace, once P0 is stable and daily-driven.
