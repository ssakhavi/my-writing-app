# Typora Clone — Task Breakdown

Derived from `typora-clone-prd.md` and `typora-clone-system-design.md`. Organized by phase, matching the PRD's suggested phasing. Each task maps back to a P0/P1 requirement or a system-design component.

## Working agreement (strict requirements)

- **TDD**: every implementation task below is preceded by writing a failing test first. Tasks are listed as `test:` / `impl:` pairs from Phase 1 onward — the `test:` line is not optional and is not to be written after the `impl:` line.
- **CI/CD**: formatting, linting, and tests are three separate, independently-required GitHub Actions checks — not one combined "lint + test" step. A PR must pass all three to merge.

## Phase 0 — Repo, CI, and project scaffolding

- [ ] Create GitHub repository (decide public vs. private — open question in PRD)
- [ ] Scaffold Tauri v2 project (Rust backend + frontend build tooling)
- [ ] Set up formatting tools (`rustfmt` for Rust; `prettier` or equivalent for frontend) with a checked-in config
- [ ] Set up linting tools (`clippy` for Rust; `eslint` or equivalent for frontend) with a checked-in config
- [ ] Set up test runner scaffolding (Rust `cargo test`; frontend test framework — e.g. Vitest) and confirm a trivial red→green test runs before any real code is written
- [ ] Write GitHub Actions workflow with three separate required jobs: `format-check` (fails on unformatted code, does not auto-fix), `lint` (fails on lint errors), `test` (runs Rust + frontend suites)
- [ ] Write GitHub Actions release workflow: build packaged app artifact on tagged release (macOS first, per PRD)
- [ ] Add branch protection requiring all three checks (`format-check`, `lint`, `test`) to pass before merge
- [ ] Write initial README (setup, build, run instructions, and the TDD/CI working agreement above)

## Phase 0.5 — Engine spike (de-risk before committing to architecture) — COMPLETE, GO (2026-07-20)

Spike code is deliberately exempt from strict TDD (its purpose is throwaway learning), but the round-trip check itself must be a real automated test, since it's the go/no-go gate.

- [x] Prototype Milkdown live rendering of headings, bold/italic, lists — `src/spike/MilkdownSpike.tsx` (Crepe editor, toggled via "Milkdown spike" button in the app shell). **Manually verified** on a real machine (`npm run tauri dev`): formatting applies live with no lag or flicker.
- [x] Prototype Milkdown table editing — same spike component; Crepe's default `Table` feature is enabled. **Manually verified**, but only after fixing a real bug: the spike originally only imported `@milkdown/crepe/theme/classic.css` (color/font tokens only), not `@milkdown/crepe/theme/common/style.css` (the actual structural styles for tables, hover-triggered row/column add controls, block-edit handles, etc.). Without it, the add-row/add-column controls exist in the DOM and are functional but invisible — which is exactly what got reported ("I can't see rows being added"). Both stylesheets are required; documented in the component's own comments so this doesn't get rediscovered.
- [x] Wire up `pulldown-cmark` in Rust — already in `src-tauri/Cargo.toml`; also used standalone in `tools/md-validator` (see below)
- [x] test: round-trip test asserting Milkdown's serialized output re-parses cleanly through `pulldown-cmark` for every P0 construct — `src/__tests__/milkdown-roundtrip.test.ts`, 13/13 passing. Built `tools/md-validator`, a standalone Rust crate (no Tauri/GTK dependency, so it compiles anywhere `pulldown-cmark` itself compiles) that parses markdown and reports structural findings as JSON; the frontend test shells out to it via `src/spike/mdValidator.ts` (`cargo run`) so the check genuinely crosses the JS/Rust boundary rather than trusting Milkdown's own serializer
- [x] Explicit go/no-go check based on that test's results — **GO.** Headings, bold/italic/strikethrough/inline code, ordered/unordered/task lists, blockquotes, links, horizontal rules, fenced code blocks (with language), tables, and inline/block math (survives as literal text — `pulldown-cmark` has no math extension, which is fine, math delimiters aren't meant to be structurally parsed) all round-trip correctly
- [x] Real finding, not just a pass/fail: Crepe's default `ImageBlock` feature discards accessible alt text — it repurposes the markdown `alt` field as an internal image-resize ratio (`node_modules/@milkdown/components/src/image-block/schema.ts`). Fix: disable `CrepeFeature.ImageBlock`, which falls back to inline image handling and preserves alt text correctly (verified in the round-trip test and applied in the spike component). Revisit if resizable images turn out to matter more than alt-text fidelity — could instead extend the `image-block` schema with a real `alt` attribute alongside `ratio`.
- [ ] Fallback plan check: not needed — Milkdown passed the gate, no need to evaluate the CodeMirror 6 + markdown-it fallback
- [ ] Prototype typewriter scrolling behavior against Milkdown/ProseMirror's default scroll handling — **still open.** The spike doesn't implement typewriter scrolling (fixed vertical caret position while typing) at all yet — that's real Phase 2 work, not something to eyeball on the default-scroll spike. Not a Phase 1 blocker, but pick this up before Phase 2's "typewriter scrolling" task starts, since it's flagged as a risk area (fighting ProseMirror's own scroll-into-view behavior).

## Phase 1 — P0 core: shell, file I/O, basic editing

Every row below is a test-first pair: write and confirm the test fails, then implement until it passes.

**App shell**
- [ ] test: app launches to an editable window within the target cold-start budget → impl: Tauri window/menu shell (minimal chrome per distraction-free goal). **Not automated** — real cold-start timing needs an actual OS process launch, which can't be measured in a headless test; tracked instead via the Cross-cutting "track cold-start time locally" item.
- [x] test: preferences persist and reload correctly (theme, focus-mode defaults, autosave interval) → impl: local preferences store as a flat local config file. `src-tauri/src/preferences.rs` (`get_preferences`/`set_preferences`, backed by `store.rs`'s generic JSON load/save), 4 Rust unit tests (defaults, round-trip, lowercase theme serialization, missing-field fallback via `#[serde(default)]`). `src/fileCommands.ts` wraps both commands with snake_case↔camelCase mapping (7 tests); `App.tsx` loads preferences on mount. Theme/focus-mode *application* (actually changing how the app looks/behaves) is Phase 2 scope per that phase's own Themes/Focus-mode sections — this task is the persistence layer only.

**File I/O (Rust commands)**
- [x] test: `open_file` reads a known file's contents correctly, including via native dialog path → impl: `open_file` command. `src-tauri/src/file_io.rs`: `read_markdown_file` is the testable pure core (2 tests: known file, missing file); the command wraps it and falls back to `tauri-plugin-dialog`'s native picker when no path is given. The dialog path itself isn't unit-testable (drives real OS UI).
- [x] test: `save_file` rejects content that fails `pulldown-cmark` validation, and writes atomically (temp file + rename) on success → impl: `save_file` command. `validate_markdown` + `atomic_write` (via `tempfile::NamedTempFile` + `persist`), 6 tests covering acceptance of ordinary and unusual-but-valid markdown, NUL-byte rejection, atomic overwrite, and that a rejected save never touches the original file. Note: CommonMark parsers are permissive by design, so "validation" here is narrower than it sounds — see the module doc comment.
- [x] test: recent-files list caps at N entries and evicts oldest correctly → impl: `get_recent_files` / `add_recent_file` commands. `src-tauri/src/recent_files.rs`: `add_recent` is the pure, tested core (5 tests: insert-at-front, dedup-and-move-to-front, cap enforcement, oldest-eviction, empty-list). Cap is 10, the top of the PRD's "last 5–10 files" range.
- [x] test: recent-files UI reflects backend state → impl: recent-files UI (no persistent file-tree sidebar, per PRD non-goal). `src/RecentFilesMenu.tsx`, a toolbar dropdown showing basenames of `getRecentFiles()`'s result; 4 tests (hidden when empty, closed by default, shows basenames, selects full path and closes).

**Editor core**
- [x] test: Milkdown editor mounts and accepts input → impl: integrate Milkdown into the frontend shell. `src/MilkdownEditor.tsx` replaces the Phase 0.5 spike/placeholder as the real editor, same Crepe config the round-trip test validated (`ImageBlock` disabled, both theme stylesheets). 4 tests: mounts + renders initial content, `getMarkdown()` reflects it, `insertMarkdown()` inserts at cursor and fires `onMarkdownChange`, survives unmount right after mount.
- [x] test: each basic construct (bold, italic, strikethrough, headings, ordered/unordered/task lists, blockquotes, links, images, horizontal rules) renders correctly and serializes back to the expected markdown → impl: basic formatting support. Covered by the Phase 0.5 round-trip suite (`src/__tests__/milkdown-roundtrip.test.ts`, 13/13), which exercises the same Crepe configuration `MilkdownEditor` now uses in production.
- [x] test: full round-trip (type → serialize → `pulldown-cmark` validate) passes for all Phase 1 constructs → impl: wire the save path through the validated round-trip. `App.tsx`'s Save button calls `editorRef.getMarkdown()` → `saveFile(path, content)` → Rust `save_file` → `validate_markdown` (parses via `pulldown-cmark`) → `atomic_write`. End-to-end path exists and is unit-tested piece by piece; not yet manually verified on a real machine (see note below).

**Known gap: this sandbox can't compile `src-tauri` end to end.** Same limitation as Phase 0/the diagram panel — no `sudo` here to install WebKitGTK. All the Rust modules above were verified via `cargo fmt` (full syntax/AST check, passes) and by manually cross-referencing every external API call (`tauri::Manager::path`, `tauri_plugin_dialog::DialogExt`, `FilePath::into_path`, etc.) against the actual downloaded crate source in `~/.cargo/registry`, since `cargo check`/`cargo test`/`cargo clippy` all fail at the same `gdk-sys` pkg-config step before reaching this crate's own code. Before trusting this Phase 1 backend work, run `cd src-tauri && cargo test && cargo clippy --all-targets -- -D warnings` on a real machine (confirmed working previously — the diagram panel's `Cargo.lock` update proved `cargo build` succeeds there) — this hasn't been done yet for this batch of changes.

**Slash-command menu** — Crepe ships trigger detection, filtering, arrow-key nav, Enter-to-insert, and Escape-to-dismiss out of the box (`BlockEdit` feature), so the scaffolding sub-tasks originally planned here were superseded by *customizing* that existing menu rather than building one from scratch:
- [x] test: menu drops the "Divider" item → impl: `featureConfigs[Crepe.Feature.BlockEdit].textGroup.divider = null` in `MilkdownEditor.tsx`. `src/__tests__/MilkdownEditor.slashMenu.test.tsx`.
- [x] test: a "Format" group (Bold/Italic/Strikethrough/Inline Code) is added, each item calling the matching Milkdown toggle-mark command → impl: `buildMenu` callback adds the group and wires `toggleStrongCommand`/`toggleEmphasisCommand`/`toggleInlineCodeCommand` (`@milkdown/kit/preset/commonmark`) and `toggleStrikethroughCommand` (`@milkdown/kit/preset/gfm`) via `commandsCtx`.
- [x] test: a "Diagram" item is added to the "Advanced" group and opens the diagram panel → impl: `buildMenu` appends to Crepe's existing `advanced` group (`builder.getGroup('advanced')`); `onRun` calls a `onOpenDiagramPanelRef` (ref, not the raw prop — the Crepe instance is created once on mount, so a ref sidesteps stale-closure issues if `onOpenDiagramPanel`'s identity ever changes). `App.tsx` passes `openDrawing` for this prop. Tested against a minimal stand-in for Crepe's `GroupBuilder` (see the test file's header comment for why the real slash menu isn't driven directly — simulating a `/` keystroke into ProseMirror's contenteditable in jsdom is unreliable).
- [x] test: `diagramImageSrc` converts a raw path via `convertFileSrc` → impl: **fixed the pre-existing "diagram PNG doesn't render inline" bug.** Root cause: `save_diagram` returns a raw absolute filesystem path, and Tauri webviews can't load `<img src>` from a raw path — it has to go through the asset protocol. Added `fileCommands.diagramImageSrc()` (wraps `convertFileSrc`), applied in `App.tsx`'s `handleInsert`; enabled the protocol in `tauri.conf.json` (`app.security.assetProtocol`, scoped to `$APPDATA/diagrams/*`, matching where `save_diagram` writes files) and the `protocol-asset` Cargo feature on the `tauri` dependency (required for the protocol handler to compile in at all — config alone isn't enough). Known limitation: this bakes an `asset://`-scheme URL into the saved markdown, so diagram images won't resolve if the `.md` file is opened on a different machine or the app-data dir changes; acceptable for now, worth revisiting if portable documents become a priority.

## Phase 2 — P0 completion: rich content, focus mode, export, safety

Same test-first pairing applies throughout.

**Rich content**
- [ ] test: fenced code block renders with correct language highlighting and serializes back to valid markdown → impl: syntax highlighting (highlight.js, per tech research recommendation)
- [ ] test: inline `$...$` and block `$$...$$` math render via KaTeX and round-trip correctly → impl: KaTeX integration
- [ ] test: table row/column add and remove update both the rendered table and the serialized markdown → impl: table editing UI
- [ ] test: footnote reference + definition insert, render, and round-trip correctly → impl: footnote support
- [ ] test: subscript and superscript inline marks render and round-trip correctly → impl: subscript/superscript support
- [ ] test: definition lists and abbreviations render and round-trip correctly → impl: definition list + abbreviation support

**Slash-command menu (full coverage)**
- [ ] test: menu entries exist for every Phase 2 construct (tables, code blocks, math, footnotes, subscript, superscript, definition lists, abbreviations) and insert correctly → impl: wire Phase 2 constructs into the menu
- [ ] test: inserting a footnote via the slash menu places the reference at the cursor and the definition in the correct slot; inserting subscript/superscript wraps the current selection or opens an empty inline mark ready for input → impl: construct-specific insertion behavior for less-trivial elements

**Focus mode**
- [ ] test: focus-mode toggle hides chrome and is reachable via keyboard shortcut → impl: global focus-mode toggle
- [ ] test: cursor stays within a fixed vertical band during continuous typing → impl: typewriter scrolling
- [ ] test: dimming toggles independently of focus mode and dims all but the current paragraph/sentence → impl: paragraph/sentence dimming
- [ ] test: focus-mode/dimming state is restored on relaunch within the same session → impl: state persistence

**Themes**
- [ ] test: light theme applies expected tokens/contrast → impl: light theme
- [ ] test: dark theme applies expected tokens/contrast → impl: dark theme
- [ ] test: theme choice persists across restarts without requiring document reload → impl: theme switcher UI

**Export**
- [ ] test: HTML export output matches expected structure for all P0 constructs → impl: `export` Rust command, markdown → HTML via pulldown-cmark
- [ ] test: PDF export produces a valid file and matches in-app rendering (visual diff or structural check) → impl: `export` Rust command, markdown → PDF via webview print pipeline

**Autosave / crash recovery**
- [ ] test: autosave writes to the recovery journal on debounce, and never touches the original file → impl: `autosave_tick` command
- [ ] test: an orphaned journal is detected on startup → impl: `check_recovery` command + startup check
- [ ] test: recovery prompt appears and restores content correctly when a journal is found → impl: recovery-prompt UI
- [ ] test: journal is deleted on clean save and clean exit, and not on crash → impl: journal cleanup logic

**Manual verification (not unit-testable, still required before Phase 2 sign-off)**
- [ ] Offline-only check: disable network at the OS level, confirm full functionality
- [ ] Crash-recovery check: kill the app mid-edit, confirm the recovery flow restores content

**Documentation**
- [ ] Architecture doc: editor engine choice, Tauri command boundary, file format handling (can largely draw from `typora-clone-system-design.md`)

## Phase 3 — P1 polish (post-MVP, once daily-driven)

Same test-first pairing applies.

- [ ] test: command palette (Cmd+K-style, distinct from the P0 slash-command menu) opens and executes each mapped formatting/app-level command → impl: command palette
- [ ] test: find/replace locates and substitutes matches correctly, including edge cases (no matches, overlapping matches) → impl: find and replace
- [ ] test: word/character count and timer report correct values on demand → impl: word/character count + session writing timer
- [ ] test: autosave interval setting changes actual debounce timing → impl: configurable autosave interval UI
- [ ] test: notifications are suppressed while focus mode is active, restored on exit → impl: "do not disturb" integration
- [ ] Windows and Linux packaged builds (extend CI release matrix; format/lint/test jobs must pass on each target OS, not just build)

## Cross-cutting / ongoing

- [ ] Keep all three CI checks (`format-check`, `lint`, `test`) green on every merge, as independently required checks — not a combined step (already gated in Phase 0, enforced throughout)
- [ ] Enforce TDD discipline in code review: no PR should introduce implementation code without a preceding test commit/diff covering it
- [ ] Track cold-start time locally; flag regressions past the 500ms target
- [ ] Track input responsiveness on documents approaching ~5,000 lines; flag regressions past the 16ms/keystroke target
- [ ] Revisit open questions as they're resolved: OS build scope, repo visibility, autosave interval default

## Diagram support — tldraw drawing panel (added ahead of schedule, 2026-07-20)

Supersedes the deferred item below for freeform diagrams specifically. Decision: rather than a text-syntax diagram language (Mermaid/D2, per `typora-clone-mermaid-alternatives.md`), the user asked directly for tldraw as a freeform drawing tool available on demand. Implemented as a standalone panel, not inline editable blocks: draw on a full-screen tldraw canvas, "Insert diagram" flattens the page to PNG and inserts a normal `![diagram](path)` markdown image reference. This sidesteps the file-format questions inline embedding would raise (storing tldraw scene JSON in/alongside the document) and works even though the Milkdown editor doesn't exist yet — for now it targets the placeholder textarea shell in `src/App.tsx`.

- [x] Add React + tldraw dependencies, wire Vite/tsconfig/eslint for JSX
- [x] Minimal app shell (toolbar + textarea) to host the panel pre-Milkdown
- [x] `DiagramPanel` component: full-screen tldraw canvas, Insert/Cancel
- [x] `save_diagram` Rust command: decode base64 PNG, write to `<app data dir>/diagrams/<uuid>.png`
- [x] Insert markdown image reference at cursor on save
- [x] Retrofit to the working agreement: extracted `decode_diagram_png` as a pure, unit-tested function (base64 round-trip, invalid input, filename uniqueness); added Vitest + Testing Library coverage for `App` (open/close, cursor-position insertion) and `DiagramPanel` (no-shapes error, success path, save-failure error, cancel), with tldraw/`invoke` mocked out
- [ ] `cargo test`/`cargo clippy` on `save_diagram` haven't run end-to-end — this sandbox has no `sudo` to install the WebKitGTK/GTK dev libs Tauri needs to compile (`cargo fmt` and the extracted-function unit tests were verified in isolation; full compile is gated on CI or a real dev machine with prerequisites installed)
- [ ] Once Milkdown exists: reconcile the placeholder textarea shell with the real editor, and re-run this insertion flow against it
- [ ] Revisit whether diagrams should also support inline re-editable tldraw blocks (Option B from the original scope discussion) rather than flattened images only
- [ ] Diagrams currently save to the app data dir, not alongside the document — revisit once file-open/save (Phase 1) exists, so images can live in a doc-relative `assets/` folder for portability

## Tufte-style preview theme — sidenote footnotes (requested 2026-07-20)

New, not in the original PRD. Extends the P0 theme system (light/dark, Phase 2) with a third built-in theme modeled on Tufte-CSS: footnotes render as sidenotes in the right margin next to their reference point, instead of collected at the bottom of the document. Depends on the Phase 2 footnote task (line "test: footnote reference + definition insert, render, and round-trip correctly") — sidenotes are a rendering variant of that construct, not a new markdown syntax, so markdown source and round-trip behavior are unaffected; only the WYSIWYG rendering changes.

- [ ] Open question: does this apply globally (replacing body typography/margins document-wide) as a fourth theme choice, or is it a toggle orthogonal to light/dark that only changes footnote placement? Decide before implementation.
- [ ] test: footnote definitions render as sidenotes in the right margin, vertically aligned with their reference point, rather than collected at document end → impl: sidenote layout for footnotes under Tufte theme
- [ ] test: sidenotes with closely-spaced references stack without overlapping → impl: vertical collision handling for stacked sidenotes
- [ ] test: below a defined viewport-width breakpoint (no room for a margin), footnotes fall back to standard bottom-of-document rendering → impl: responsive breakpoint fallback
- [ ] test: Tufte theme applies expected typography tokens (serif body font, margin width) and passes the same token/contrast check used for light/dark → impl: Tufte theme stylesheet
- [ ] test: switching to/from the Tufte theme persists and applies without reload, consistent with the existing theme switcher → impl: wire into existing theme switcher UI

## Explicitly deferred (P2 / future — do not schedule yet)

- Custom theme editor / user-defined CSS
- Extension/plugin system
- Multi-window / multi-document support
- External sync (Dropbox/iCloud) file-watching support
- Outline/table-of-contents navigation
- Text-syntax diagram language (Mermaid/D2/etc.) — freeform drawing is now covered by the tldraw panel above; a typed diagram syntax remains a separate, still-deferred decision
