import { describe, expect, it } from 'vitest';
import { recallMemories, buildMemoryAttachment } from '../src/lib/memory/memoryContextService';
import type { MemoryEntry } from '../src/types/domain';

function entry(over: Partial<MemoryEntry>): MemoryEntry {
  return {
    id: over.id ?? 'id',
    content: over.content ?? 'conteúdo',
    kind: over.kind ?? 'note',
    scope: over.scope ?? 'global',
    project: over.project,
    origin: over.origin ?? 'user',
    confidence: over.confidence ?? 1,
    manual: over.manual ?? true,
    createdAt: over.createdAt ?? '2026-05-01T00:00:00Z',
    updatedAt: over.updatedAt,
  };
}

const base = [
  entry({ id: 'g', scope: 'global', content: 'usuário prefere respostas curtas' }),
  entry({ id: 'p', scope: 'project', project: 'ailu', content: 'projeto ailu usa tauri' }),
  entry({ id: 'o', scope: 'project', project: 'outro', content: 'projeto outro usa flutter' }),
];

describe('recallMemories scope rules', () => {
  it('1. global memory enters in default mode', () => {
    const got = recallMemories(base, { mode: 'default', activeProject: 'ailu', query: '', enabled: true });
    expect(got.map((e) => e.id)).toContain('g');
  });

  it('2. active project memory enters in default mode', () => {
    const got = recallMemories(base, { mode: 'default', activeProject: 'ailu', query: '', enabled: true });
    expect(got.map((e) => e.id)).toContain('p');
  });

  it('3. another project memory never enters', () => {
    const got = recallMemories(base, { mode: 'default', activeProject: 'ailu', query: '', enabled: true });
    expect(got.map((e) => e.id)).not.toContain('o');
  });

  it('4. project_only excludes global memory', () => {
    const got = recallMemories(base, { mode: 'project_only', activeProject: 'ailu', query: '', enabled: true });
    expect(got.map((e) => e.id)).toEqual(['p']);
  });

  it('5. disabled memory injects nothing', () => {
    const got = recallMemories(base, { mode: 'default', activeProject: 'ailu', query: '', enabled: false });
    expect(got).toHaveLength(0);
    expect(buildMemoryAttachment(base, { mode: 'default', activeProject: 'ailu', query: '', enabled: false })).toBeUndefined();
  });

  it('6. size/count limits are respected', () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      entry({ id: `g${index}`, scope: 'global', content: 'x'.repeat(100) }),
    );
    const byCount = recallMemories(many, { mode: 'default', query: '', enabled: true, maxEntries: 5, maxChars: 100_000 });
    expect(byCount).toHaveLength(5);

    const byChars = recallMemories(many, { mode: 'default', query: '', enabled: true, maxEntries: 100, maxChars: 250 });
    const total = byChars.reduce((sum, e) => sum + e.content.length, 0);
    expect(total).toBeLessThanOrEqual(300); // ~250 budget, allows the first overflowing entry
    expect(byChars.length).toBeLessThan(30);
  });
});

describe('buildMemoryAttachment', () => {
  it('produces an explicit, labeled, non-opaque context block', () => {
    const attachment = buildMemoryAttachment(base, { mode: 'default', activeProject: 'ailu', query: 'tauri', enabled: true });
    expect(attachment).toBeDefined();
    expect(attachment?.contextSource).toBe('memory');
    expect(attachment?.contextText).toContain('[memórias do usuário');
    expect(attachment?.contextText).toContain('[global]');
    expect(attachment?.contextText).toContain('[projeto:ailu]');
    // never leaks the other project
    expect(attachment?.contextText).not.toContain('flutter');
  });

  it('ranks query-relevant memories first', () => {
    const entries = [
      entry({ id: 'a', scope: 'global', content: 'gosta de café pela manhã' }),
      entry({ id: 'b', scope: 'global', content: 'trabalha com rust e tauri todo dia' }),
    ];
    const got = recallMemories(entries, { mode: 'default', query: 'me ajuda com rust', enabled: true });
    expect(got[0].id).toBe('b');
  });
});
