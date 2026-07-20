# Typora Clone

A minimalist, offline-first Markdown WYSIWYG editor — a Typora-style writing app built with Tauri, Milkdown, and `pulldown-cmark`.

See `docs/typora-clone-prd.md` for product scope, `docs/typora-clone-system-design.md` for architecture, and `docs/typora-clone-tasks.md` for the phased task breakdown this repo follows.

## Stack

- **Shell**: Tauri v2 (Rust backend, native webview)
- **Frontend**: Vite + TypeScript (vanilla, no UI framework)
- **Editor engine**: Milkdown (ProseMirror-based WYSIWYG)
- **Markdown parsing/validation**: `pulldown-cmark` (Rust)

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- [Node.js](https://nodejs.org/) 20+
- Tauri's platform prerequisites: see the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/) — on Linux this means `webkit2gtk`, `libgtk-3-dev`, `librsvg2-dev`, etc.

## Setup

```bash
npm install
```

## Develop

```bash
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

## Working agreement

This project follows two non-negotiable rules, enforced in CI:

**Test-driven development.** Every implementation task is preceded by a failing test. Don't write implementation code without a preceding test commit that covers it — see `docs/typora-clone-tasks.md` for the phased `test:` / `impl:` breakdown this repo follows.

**Three independent CI checks.** `format-check`, `lint`, and `test` are separate required GitHub Actions jobs, not one combined step. All three must pass before a PR can merge.

| Command                                        | Purpose                      |
| ---------------------------------------------- | ---------------------------- |
| `npm run format:check` / `cargo fmt --check`   | Formatting (frontend / Rust) |
| `npm run lint` / `cargo clippy -- -D warnings` | Linting (frontend / Rust)    |
| `npm run test` / `cargo test`                  | Tests (frontend / Rust)      |

`npm run format` fixes frontend formatting in place; `cargo fmt` (without `--check`) does the same for Rust.

## Releases

Pushing a tag matching `v*.*.*` triggers `.github/workflows/release.yml`, which builds a macOS app artifact and drafts a GitHub release. Windows/Linux packaging is deferred to Phase 3 per the task breakdown.
