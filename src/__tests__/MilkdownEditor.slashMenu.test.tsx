// Verifies the slash-menu customization Crepe is configured with —
// removing the "Divider" item and adding a "Diagram" item. Exercising the
// real slash menu would mean simulating a "/" keystroke into a ProseMirror
// contenteditable in jsdom, which is fragile and not how the rest of this
// suite tests Milkdown integration points (see fileCommands.test.ts for the
// established pattern of mocking the boundary and asserting on what's
// passed across it). Instead this mocks the `Crepe` class, captures the
// `featureConfigs` object MilkdownEditor constructs it with, and drives
// `buildMenu` directly against a minimal stand-in for Crepe's
// `GroupBuilder` — the same shape documented in
// node_modules/@milkdown/crepe/lib/types/utils/group-builder.d.ts, with the
// default text/list/advanced groups pre-seeded the way Crepe's real
// `getGroups()` seeds them before calling `buildMenu`.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

let capturedConfig: Record<string, unknown> | undefined;

class MockCrepe {
  static Feature = { ImageBlock: 'image-block', BlockEdit: 'block-edit' };
  editor = { action: vi.fn() };
  constructor(config: Record<string, unknown>) {
    capturedConfig = config;
  }
  on() {}
  create() {
    return Promise.resolve();
  }
  destroy() {
    return Promise.resolve();
  }
  getMarkdown() {
    return '';
  }
}

vi.mock('@milkdown/crepe', () => ({ Crepe: MockCrepe }));
vi.mock('@milkdown/crepe/theme/common/style.css', () => ({}));
vi.mock('@milkdown/crepe/theme/classic.css', () => ({}));

const { default: MilkdownEditor } = await import('../MilkdownEditor');

interface FakeItem {
  key: string;
  label: string;
  onRun?: (ctx: unknown) => void;
}

/** Minimal stand-in for Crepe's GroupBuilder, pre-seeded with the default
 * groups the way `getGroups()` seeds them before invoking `buildMenu`. */
function makeFakeBuilder() {
  const groups: Record<string, FakeItem[]> = { text: [], list: [], advanced: [] };
  const groupHandle = (key: string) => ({
    addItem: (itemKey: string, item: Omit<FakeItem, 'key'>) => {
      groups[key].push({ key: itemKey, ...item });
    },
  });
  return {
    groups,
    addGroup: (key: string) => {
      groups[key] = [];
      return groupHandle(key);
    },
    getGroup: (key: string) => {
      if (!(key in groups)) throw new Error(`Group with key ${key} not found`);
      return groupHandle(key);
    },
  };
}

function getBlockEditConfig() {
  const featureConfigs = capturedConfig?.featureConfigs as
    { 'block-edit'?: Record<string, unknown> } | undefined;
  const config = featureConfigs?.['block-edit'];
  if (!config) throw new Error('block-edit featureConfig was not passed to Crepe');
  return config as { textGroup?: { divider?: unknown }; buildMenu: (builder: unknown) => void };
}

describe('MilkdownEditor slash-menu customization', () => {
  beforeEach(() => {
    capturedConfig = undefined;
  });

  it('removes the Divider item from the text group', () => {
    render(<MilkdownEditor initialMarkdown="" />);

    expect(getBlockEditConfig().textGroup?.divider).toBeNull();
  });

  it('does not add a Format group to the menu', () => {
    render(<MilkdownEditor initialMarkdown="" />);
    const builder = makeFakeBuilder();

    getBlockEditConfig().buildMenu(builder);

    expect(builder.groups.format).toBeUndefined();
  });

  it('adds a Diagram item to the advanced group that opens the diagram panel', () => {
    const onOpenDiagramPanel = vi.fn();
    render(<MilkdownEditor initialMarkdown="" onOpenDiagramPanel={onOpenDiagramPanel} />);
    const builder = makeFakeBuilder();

    getBlockEditConfig().buildMenu(builder);

    const diagramItem = builder.groups.advanced?.find((item) => item.key === 'diagram');
    expect(diagramItem).toBeDefined();

    diagramItem?.onRun?.({});
    expect(onOpenDiagramPanel).toHaveBeenCalledTimes(1);
  });

  it('calls the latest onOpenDiagramPanel even if the prop changes after mount', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<MilkdownEditor initialMarkdown="" onOpenDiagramPanel={first} />);
    rerender(<MilkdownEditor initialMarkdown="" onOpenDiagramPanel={second} />);

    const builder = makeFakeBuilder();
    getBlockEditConfig().buildMenu(builder);
    const diagramItem = builder.groups.advanced?.find((item) => item.key === 'diagram');

    diagramItem?.onRun?.({});

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
