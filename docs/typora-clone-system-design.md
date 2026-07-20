# System Design — Typora Clone

Based on `typora-clone-prd.md`, `typora-clone-tech-research.md`, and `typora-clone-mermaid-alternatives.md`.

## 1. Requirements Recap

**Functional**
- Single-pane WYSIWYG markdown editing (no source/preview split): headings, emphasis, lists, tables, code blocks with highlighting, math (KaTeX), links, images.
- Open a single file (native dialog or recent-files list) — no persistent file-tree browser.
- Focus mode: hide chrome, typewriter scrolling, optional paragraph/sentence dimming.
- Theming: at least one light and one dark built-in theme.
- Export to PDF and standalone HTML.
- Autosave / crash recovery.
- Fully offline operation.

**Non-functional**
- Cold start < 500ms.
- No perceptible input lag (<16ms/keystroke) up to ~5,000-line documents.
- Zero network calls for any core operation.
- Automated tests + CI/CD gating merges (GitHub Actions).
- Single user, single machine, single document open at a time (v1) — this is not a multi-tenant or networked system.

**Constraints**
- Tauri v2 (Rust backend + native OS webview frontend) — already decided.
- No PKM features (no backlinks, graph, tagging).
- No deadline; part-time solo effort.

Because this is a single-user local desktop app, the usual distributed-systems concerns (horizontal scaling, load balancing, multi-region failover, queueing) don't apply. "Scale" here means: large documents, fast I/O, and resilience to crashes — not concurrent users or request throughput. The design below is scoped accordingly, and Section 5 explains why the standard scale playbook is deliberately not used.

## 2. High-Level Design

### 2.1 Component diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Tauri Application                        │
│                                                                    │
│  ┌───────────────────────────┐      ┌───────────────────────┐   │
│  │      Frontend (WebView)     │      │   Backend (Rust core)  │   │
│  │                             │      │                        │   │
│  │  ┌───────────────────────┐ │      │  ┌──────────────────┐  │   │
│  │  │  Editor Shell          │ │      │  │ File I/O commands │  │   │
│  │  │  - focus mode toggle   │ │      │  │  open/save/watch  │  │   │
│  │  │  - theme switcher      │ │◄────►│  └──────────────────┘  │   │
│  │  │  - recent-files list   │ │ IPC  │  ┌──────────────────┐  │   │
│  │  └───────────────────────┘ │      │  │ Markdown engine    │  │   │
│  │  ┌───────────────────────┐ │      │  │  pulldown-cmark:   │  │   │
│  │  │  Milkdown (ProseMirror)│ │      │  │  parse/validate/   │  │   │
│  │  │  - WYSIWYG doc model   │ │      │  │  serialize, round- │  │   │
│  │  │  - table/code/math     │ │      │  │  trip check        │  │   │
│  │  │    plugins (KaTeX,     │ │      │  └──────────────────┘  │   │
│  │  │    highlight.js)       │ │      │  ┌──────────────────┐  │   │
│  │  └───────────────────────┘ │      │  │ Export pipeline    │  │   │
│  │  ┌───────────────────────┐ │      │  │  → HTML, → PDF     │  │   │
│  │  │  Autosave buffer       │ │      │  └──────────────────┘  │   │
│  │  │  (debounced, in-memory)│ │      │  ┌──────────────────┐  │   │
│  │  └───────────────────────┘ │      │  │ Crash-recovery     │  │   │
│  └───────────────────────────┘      │  │  journal (on disk)  │  │   │
│                                       │  └──────────────────┘  │   │
│                                       └───────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                    │                              │
                    ▼                              ▼
           Native OS WebView               Local filesystem
        (WKWebView/WebView2/WebKitGTK)   (.md file, recovery journal,
                                           theme/prefs config)
```

### 2.2 Data flow — typical editing session

```
1. Launch
   Rust backend boots → reads prefs (theme, recent files) from local
   config file → frontend mounts Milkdown editor shell → if a file
   was passed (CLI arg / recent-files click), Rust reads it from disk
   and hands raw markdown text to the frontend over IPC.

2. Parse → render
   Frontend passes raw markdown into Milkdown's parser (remark/
   unified-based, ProseMirror doc model) → renders WYSIWYG view.

3. Typing
   Every edit updates Milkdown's in-memory doc model → on a debounce
   (e.g. 300–500ms of idle, or a periodic tick) the frontend serializes
   the doc back to markdown text and:
     a) writes it to an in-memory/localStorage-free autosave buffer
        (per artifact rules, no browser storage — buffer lives in
        Rust-side state via IPC instead, see 3.3)
     b) sends it to the Rust backend to append/overwrite the on-disk
        recovery journal.

4. Explicit save (Cmd+S)
   Frontend serializes current doc → sends to Rust `save_file` command
   → Rust independently re-parses the serialized markdown with
   pulldown-cmark as a validation pass (round-trip check) → if valid,
   writes to the target .md file atomically (write to temp file +
   rename) → clears/rotates the recovery journal for this file.

5. Export
   Frontend requests export → Rust command takes the current markdown
   → pulldown-cmark parses → renders HTML (for HTML export) or HTML
   + headless print-to-PDF via the OS webview's print pipeline (for
   PDF export) → writes output file.

6. Crash recovery (next launch)
   On startup, Rust checks for an orphaned recovery journal (a save
   that didn't complete cleanly) → if found, frontend prompts to
   restore before opening the file normally.
```

### 2.3 "API" contract — Tauri IPC commands

Tauri apps don't have a network API; the equivalent contract is the set of Rust `#[tauri::command]` functions the frontend invokes. Treat this as the system's API surface and design it deliberately:

| Command | Direction | Purpose | Notes |
|---|---|---|---|
| `open_file(path?)` | FE → BE | Read a file from disk, or open native dialog if no path | Returns raw markdown + file metadata (mtime, path) |
| `save_file(path, content)` | FE → BE | Validate (pulldown-cmark round-trip) + atomic write | Returns success/error; error includes what failed to validate |
| `autosave_tick(content)` | FE → BE | Write/update recovery journal | Fire-and-forget from FE's perspective, debounced |
| `check_recovery(path)` | BE → FE (on launch) | Signal an orphaned journal exists | FE prompts user |
| `export(content, format, target_path)` | FE → BE | Render to HTML or PDF | `format: "html" \| "pdf"` |
| `get_recent_files()` / `add_recent_file(path)` | FE ↔ BE | Maintain recent-files list in local config | No folder-tree browsing, just a flat list per PRD |
| `get_prefs()` / `set_prefs(prefs)` | FE ↔ BE | Theme, focus-mode defaults, autosave interval | Local config file, not a database |
| `watch_file(path)` (P1) | FE → BE | Detect external edits (e.g. synced via Dropbox) | Only needed if P2 "external sync" consideration is built |

Keep this surface small deliberately — every command is a trust boundary between the sandboxed webview and the OS-privileged Rust process. Fewer, well-validated commands beat a chatty, granular API here.

## 3. Deep Dive

### 3.1 Data model

There is no database. The "data model" is:
- **The document itself**: a single `.md` file on disk, UTF-8, is the source of truth. The app should never hold a "more authoritative" copy anywhere else — Milkdown's in-memory doc is a working representation, not the source of truth.
- **Recovery journal**: one small file per open document (e.g. `~/.local/share/<app>/recovery/<hash-of-path>.md.recover`), overwritten on each autosave tick, deleted on clean save. Keeping it content-addressed by the original file's path (hashed) avoids collisions across multiple documents opened over time.
- **App preferences**: a single local config file (theme, focus-mode defaults, autosave interval, recent-files list capped at 5–10 entries). No need for a structured database — this is small, flat, infrequently-written data; a JSON or TOML file read/written by the Rust backend is sufficient.

Explicitly not modeled: no per-document metadata store, no tags, no cross-document index — consistent with the PRD's non-goal of PKM features.

### 3.2 Validation and round-trip integrity

This is the most safety-critical path given "never lose or corrupt the user's writing" is implicit in the PRD's autosave/crash-recovery goal. Two independent layers:
1. **Frontend**: Milkdown's own serializer (doc model → markdown string).
2. **Backend**: pulldown-cmark re-parses that string on every explicit save, purely to confirm it's well-formed CommonMark/GFM before committing to disk. This doesn't need to reconstruct Milkdown's doc model — it's a cheap sanity check, not a second editor.

If validation fails, the save is rejected and surfaced to the user rather than silently writing something the editor itself can't reliably reopen. This is cheap insurance given `pulldown-cmark` is already a dependency-of-choice from the tech research.

### 3.3 Autosave / crash recovery mechanism

Resolves the open question left in the PRD. Recommended approach: **debounced write to an on-disk recovery journal via the Rust backend**, not a purely in-memory buffer, because in-memory state is lost exactly when it matters most (a crash). Concretely:
- Frontend debounces edits (e.g., 500ms of typing inactivity, or a hard cap of every 10s during continuous typing) and sends the current serialized markdown to `autosave_tick`.
- Rust writes it to the recovery journal file (not the original file — the original is only touched on explicit save, so autosave can't corrupt the user's actual document even if it writes something malformed).
- On clean save or clean app exit, the journal is deleted.
- On launch, an existing journal for the file being opened means the last session ended uncleanly; prompt to restore.

This avoids two failure modes at once: losing unsaved work on crash (in-memory-only would fail this), and corrupting the real file with a bad autosave (writing directly to the original file on every keystroke would fail this).

### 3.4 Focus mode / typewriter scrolling

Purely a frontend concern — no backend involvement. Implementation notes worth capturing since they affect the editor shell's architecture:
- Focus mode = a CSS/DOM state toggle that hides toolbar/menu chrome; should be a single global state, not per-pane (there's only one pane).
- Typewriter scrolling = keep the caret's viewport offset fixed (e.g., vertically centered) by adjusting scroll position on every cursor move, not by moving the caret itself. This needs to cooperate with ProseMirror's own scroll-into-view behavior — worth flagging as a spike item alongside the Milkdown integration risk already noted in the tech research doc, since fighting the editor's default scroll behavior is a common source of jank.

### 3.5 Error handling

Given the "no distraction" goal, errors should be minimal-chrome and non-blocking wherever possible:
- **Save validation failure**: non-modal inline notice, document stays open and editable, nothing is lost (autosave journal still holds the content).
- **File open failure** (permissions, missing file): a single dialog, since this necessarily blocks further action.
- **Export failure**: inline notice; doesn't affect the open document.
- **IPC/backend crash**: since Rust owns the source of truth for file I/O, a backend crash should not silently lose data — the recovery journal (written by the backend itself) is the safety net; on relaunch, recovery flow kicks in as described in 3.3.

## 4. Scale and Reliability (reframed for single-user desktop)

Traditional "scale" analysis (QPS, horizontal scaling, load balancers) doesn't apply — there's one user, one process, one machine. The equivalent concerns here:

- **Document size scaling**: target is responsiveness up to ~5,000 lines (per PRD). ProseMirror-based editors (Milkdown) are known to degrade on very large single documents because the whole doc is one editable DOM/model tree; if documents regularly exceed this, virtualized rendering or chunked loading would need investigation — flagged as a future concern, not a v1 requirement.
- **Startup latency**: addressed structurally by choosing Tauri over Electron (per tech research: ~1.8s vs ~12s cold start in benchmarks) and by keeping the recent-files/prefs read path a single small local file read, not a scan of the filesystem.
- **Reliability**: the equivalent of "availability" here is "the app doesn't lose the user's writing." Addressed via the dual-layer validation (3.2) and the on-disk recovery journal (3.3), rather than redundancy/failover, which have no meaning for a local single-process app.
- **Monitoring/alerting**: no telemetry given the offline-only, single-user constraint (and no PRD requirement for analytics). The equivalent is local: CI test coverage on the editor core and file-I/O commands catches regressions before they reach the one user who matters.

## 5. Trade-off Analysis

| Decision | Chosen | Alternative | Trade-off |
|---|---|---|---|
| App shell | Tauri v2 | Electron | Smaller/faster (per tech research), but smaller talent pool/ecosystem if this ever needs contributors; Rust learning curve for the file-I/O and validation layer |
| Editor core | Milkdown (ProseMirror) | CodeMirror 6 + markdown-it hybrid | True single-pane WYSIWYG fits the PRD's core goal better, but ProseMirror-based editors have known large-document performance limits; CodeMirror is more proven at scale but is fundamentally a source editor with live-preview styling, not true WYSIWYG |
| Markdown validation | Dual-layer (Milkdown serialize + pulldown-cmark re-parse) | Trust Milkdown's serializer alone | Extra Rust dependency and a small amount of complexity, in exchange for a real safety net against silent corruption |
| Autosave target | On-disk recovery journal, separate from the real file | Direct autosave to the original file | Journal approach avoids corrupting the real file on a bad autosave, at the cost of a slightly more complex recovery-prompt UX on relaunch |
| File browsing | None (open dialog + recent list) | Persistent file-tree sidebar | Matches the "not a PKM" and distraction-free goals directly; makes multi-document workflows more friction-ful — deliberate trade-off per the PRD |
| Diagrams (Mermaid/D2/etc.) | Not included in v1 | Include Mermaid for Typora parity | Keeps bundle size and scope down per the PRD's anti-PKM stance; revisit as P2 if the "writing app" framing turns out to need occasional diagrams |

## 6. What to Revisit as the System Grows

- **If documents regularly exceed ~5,000 lines**: investigate whether ProseMirror/Milkdown needs virtualization or whether a hybrid source-mode-for-huge-files fallback is warranted.
- **If multi-document workflows become common** (despite the current single-file-at-a-time design): revisit the "no file tree" decision — but treat this as a deliberate re-scoping, not scope creep, given how central it is to the current distraction-free positioning.
- **If external sync tools (Dropbox/iCloud) cause file-watching conflicts**: the P2 "sync via user-provided storage" consideration already flags this; the recovery-journal design (separate from the real file) should make this safer than it would otherwise be, but file-watching (`watch_file`) would need to be built out.
- **If Windows/Linux builds are added**: re-verify the native webview assumptions (WebView2/WebKitGTK) for anything OS-specific in the export-to-PDF pipeline, which likely relies on the webview's print engine and may behave differently across platforms.
- **If diagrams are added later**: revisit the D2 recommendation from `typora-clone-mermaid-alternatives.md` and re-measure actual bundle-size/cold-start impact before committing.
