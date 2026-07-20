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

## Phase 0.5 — Engine spike (de-risk before committing to architecture)

Spike code is deliberately exempt from strict TDD (its purpose is throwaway learning), but the round-trip check itself must be a real automated test, since it's the go/no-go gate.

- [ ] Prototype Milkdown live rendering of headings, bold/italic, lists
- [ ] Prototype Milkdown table editing
- [ ] Wire up `pulldown-cmark` in Rust
- [ ] test: round-trip test asserting Milkdown's serialized output re-parses cleanly through `pulldown-cmark` for every P0 construct (headings, lists, tables, code, math, links, images)
- [ ] Explicit go/no-go check based on that test's results
- [ ] Fallback plan check: if Milkdown fails the spike, evaluate CodeMirror 6 + markdown-it hybrid (per tech research doc)
- [ ] Prototype typewriter scrolling behavior against Milkdown/ProseMirror's default scroll handling — confirm no fight between the two

## Phase 1 — P0 core: shell, file I/O, basic editing

Every row below is a test-first pair: write and confirm the test fails, then implement until it passes.

**App shell**
- [ ] test: app launches to an editable window within the target cold-start budget → impl: Tauri window/menu shell (minimal chrome per distraction-free goal)
- [ ] test: preferences persist and reload correctly (theme, focus-mode defaults, autosave interval) → impl: local preferences store as a flat local config file

**File I/O (Rust commands)**
- [ ] test: `open_file` reads a known file's contents correctly, including via native dialog path → impl: `open_file` command
- [ ] test: `save_file` rejects content that fails `pulldown-cmark` validation, and writes atomically (temp file + rename) on success → impl: `save_file` command
- [ ] test: recent-files list caps at N entries and evicts oldest correctly → impl: `get_recent_files` / `add_recent_file` commands
- [ ] test: recent-files UI reflects backend state → impl: recent-files UI (no persistent file-tree sidebar, per PRD non-goal)

**Editor core**
- [ ] test: Milkdown editor mounts and accepts input → impl: integrate Milkdown into the frontend shell
- [ ] test: each basic construct (bold, italic, strikethrough, headings, ordered/unordered/task lists, blockquotes, links, images, horizontal rules) renders correctly and serializes back to the expected markdown → impl: basic formatting support
- [ ] test: full round-trip (type → serialize → `pulldown-cmark` validate) passes for all Phase 1 constructs → impl: wire the save path through the validated round-trip

**Slash-command menu (scaffolding)**
- [ ] test: typing `/` at line start (or after whitespace) opens the menu; typing more filters the list; Escape dismisses → impl: slash-trigger detection + filterable menu component
- [ ] test: arrow keys move selection, Enter inserts the selected item at the correct cursor position → impl: keyboard navigation + insertion handler
- [ ] test: menu entries exist for every Phase 1 construct (headings, lists, blockquotes, links, images, horizontal rules) and insert correctly → impl: wire Phase 1 constructs into the menu

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

## Explicitly deferred (P2 / future — do not schedule yet)

- Custom theme editor / user-defined CSS
- Extension/plugin system
- Multi-window / multi-document support
- External sync (Dropbox/iCloud) file-watching support
- Outline/table-of-contents navigation
- Diagram support (Mermaid/D2/etc.) — pending the scope decision raised in `typora-clone-mermaid-alternatives.md`
