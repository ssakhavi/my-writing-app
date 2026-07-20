// Phase 0.5 engine spike — the explicit go/no-go gate described in
// docs/typora-clone-tasks.md and docs/typora-clone-tech-research.md: does
// Milkdown's serialized markdown output re-parse cleanly (i.e. into the
// semantically correct structure, not just "doesn't crash") through the
// real Rust `pulldown-cmark` parser the app will use for save-time
// validation?
//
// This is spike-adjacent but is itself the required automated test, per the
// working agreement ("Spike code is deliberately exempt from strict TDD...
// but the round-trip check itself must be a real automated test, since it's
// the go/no-go gate").
//
// Flow per construct: seed a headless Crepe instance with markdown -> read
// back Crepe's serialized markdown -> feed that through the real
// pulldown-cmark-backed validator binary -> assert the structure survived.
import { beforeAll, describe, expect, it } from 'vitest';
import { Crepe } from '@milkdown/crepe';
import { runMdValidator } from '../spike/mdValidator';

// Crepe's default `ImageBlock` feature repurposes the markdown `alt` field
// as an internal resize ratio (see node_modules/@milkdown/components/src/
// image-block/schema.ts) and discards real alt text entirely. Disabling it
// falls back to inline image handling, which preserves alt text correctly.
// This is a real finding from the spike, not a workaround for a test
// artifact — see docs/typora-clone-tasks.md Phase 0.5 findings.
const CREPE_FEATURES = { [Crepe.Feature.ImageBlock]: false };

async function serializeThroughMilkdown(markdown: string): Promise<string> {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const crepe = new Crepe({ root, defaultValue: markdown, features: CREPE_FEATURES });
  await crepe.create();
  const out = crepe.getMarkdown();
  await crepe.destroy();
  root.remove();
  return out;
}

beforeAll(() => {
  // Prime the cargo build once so the 13 tests below don't each pay a cold
  // compile. If this throws, every test below will fail with a clear cause
  // rather than 13 confusing individual failures.
  runMdValidator('# warm up\n');
}, 60000);

describe('Milkdown -> pulldown-cmark round-trip (Phase 0.5 go/no-go gate)', () => {
  it('headings', async () => {
    const out = await serializeThroughMilkdown('# Heading one\n\n## Heading two\n');
    const findings = runMdValidator(out);
    expect(findings.heading_levels).toEqual([1, 2]);
  }, 20000);

  it('bold, italic, strikethrough, inline code', async () => {
    const out = await serializeThroughMilkdown(
      'Some **bold**, *italic*, ~~strikethrough~~, and `inline code` text.\n',
    );
    const findings = runMdValidator(out);
    expect(findings.has_bold).toBe(true);
    expect(findings.has_italic).toBe(true);
    expect(findings.has_strikethrough).toBe(true);
    expect(findings.has_inline_code).toBe(true);
  }, 20000);

  it('unordered list', async () => {
    const out = await serializeThroughMilkdown('- one\n- two\n- three\n');
    const findings = runMdValidator(out);
    expect(findings.unordered_list_items).toBe(3);
    expect(findings.ordered_list_items).toBe(0);
  }, 20000);

  it('ordered list', async () => {
    const out = await serializeThroughMilkdown('1. one\n2. two\n3. three\n');
    const findings = runMdValidator(out);
    expect(findings.ordered_list_items).toBe(3);
  }, 20000);

  it('task list, including checked state', async () => {
    const out = await serializeThroughMilkdown('- [ ] todo\n- [x] done\n');
    const findings = runMdValidator(out);
    expect(findings.task_items).toEqual([false, true]);
  }, 20000);

  it('blockquote', async () => {
    const out = await serializeThroughMilkdown('> a quote\n> spanning two lines\n');
    const findings = runMdValidator(out);
    expect(findings.has_blockquote).toBe(true);
  }, 20000);

  it('link (url and text)', async () => {
    const out = await serializeThroughMilkdown('A [link](https://example.com) in text.\n');
    const findings = runMdValidator(out);
    expect(findings.links).toHaveLength(1);
    expect(findings.links[0].url).toBe('https://example.com');
    expect(findings.links[0].text).toBe('link');
  }, 20000);

  it('image (url and alt text) — requires ImageBlock disabled, see note above', async () => {
    const out = await serializeThroughMilkdown('![alt text](https://example.com/image.png)\n');
    const findings = runMdValidator(out);
    expect(findings.images).toHaveLength(1);
    expect(findings.images[0].url).toBe('https://example.com/image.png');
    expect(findings.images[0].alt).toBe('alt text');
  }, 20000);

  it('horizontal rule', async () => {
    const out = await serializeThroughMilkdown('above\n\n---\n\nbelow\n');
    const findings = runMdValidator(out);
    expect(findings.has_rule).toBe(true);
  }, 20000);

  it('fenced code block with language', async () => {
    const out = await serializeThroughMilkdown('```js\nconst x = 1;\n```\n');
    const findings = runMdValidator(out);
    expect(findings.code_blocks).toHaveLength(1);
    expect(findings.code_blocks[0].lang).toBe('js');
    expect(findings.code_blocks[0].text).toContain('const x = 1;');
  }, 20000);

  it('table', async () => {
    const out = await serializeThroughMilkdown('| a | b |\n| --- | --- |\n| 1 | 2 |\n');
    const findings = runMdValidator(out);
    expect(findings.tables).toHaveLength(1);
    expect(findings.tables[0].cols).toBe(2);
  }, 20000);

  it('inline math survives as literal text (pulldown-cmark has no math extension)', async () => {
    const out = await serializeThroughMilkdown('Einstein: $E = mc^2$ was famous.\n');
    const findings = runMdValidator(out);
    expect(findings.plain_text).toContain('$E = mc^2$');
  }, 20000);

  it('block math survives as literal text', async () => {
    const out = await serializeThroughMilkdown('$$\n\\int_0^1 x^2 dx\n$$\n');
    const findings = runMdValidator(out);
    expect(findings.plain_text).toContain('\\int_0^1 x^2 dx');
  }, 20000);
});
