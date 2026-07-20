// Node-only helper (test-time only, never shipped in the app bundle) that
// shells out to `tools/md-validator`, the standalone pulldown-cmark-backed
// CLI, to check whether a markdown string re-parses into the structure we
// expect. See tools/md-validator/src/main.rs for what each field means.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.resolve(__dirname, '../../tools/md-validator/Cargo.toml');

export interface ImageFound {
  url: string;
  alt: string;
  title: string;
}

export interface LinkFound {
  url: string;
  text: string;
}

export interface CodeBlockFound {
  lang: string | null;
  text: string;
}

export interface TableFound {
  rows: number;
  cols: number;
}

export interface Findings {
  heading_levels: number[];
  has_bold: boolean;
  has_italic: boolean;
  has_strikethrough: boolean;
  has_inline_code: boolean;
  has_blockquote: boolean;
  has_rule: boolean;
  unordered_list_items: number;
  ordered_list_items: number;
  task_items: boolean[];
  links: LinkFound[];
  images: ImageFound[];
  code_blocks: CodeBlockFound[];
  tables: TableFound[];
  plain_text: string;
  html: string;
}

/**
 * Runs `markdown` through the real Rust `pulldown-cmark` parser (via the
 * standalone `md-validator` binary) and returns a structural summary.
 * Requires a Rust toolchain on PATH; `cargo run` builds the binary on first
 * call and reuses the cached build afterward.
 */
export function runMdValidator(markdown: string): Findings {
  const output = execFileSync('cargo', ['run', '--manifest-path', MANIFEST_PATH, '--quiet', '--'], {
    input: markdown,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(output) as Findings;
}
