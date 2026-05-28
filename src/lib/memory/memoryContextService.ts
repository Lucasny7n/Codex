import type { ChatAttachment, MemoryEntry, MemoryRecallMode } from '../../types/domain';

/// Defaults chosen to keep the injected block small and honest.
const DEFAULT_MAX_ENTRIES = 10;
const DEFAULT_MAX_CHARS = 1600;

export interface RecallOptions {
  mode: MemoryRecallMode;
  activeProject?: string;
  query: string;
  /** Whether memory injection is enabled (settings.personalization.memoriesStored). */
  enabled: boolean;
  maxEntries?: number;
  maxChars?: number;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 3);
}

/**
 * Scope filter mirroring the Rust `memory_store::recall` semantics:
 * - default = global + the active project's memories;
 * - project_only = only the active project's memories (no global);
 * - a memory from another project never enters.
 */
function inScope(entry: MemoryEntry, mode: MemoryRecallMode, activeProject?: string): boolean {
  if (entry.scope === 'global') return mode === 'default';
  return Boolean(activeProject) && entry.project === activeProject;
}

/**
 * Composite ranking: relevance dominates, then scope (project preferred when
 * equally relevant, since it is more specific to the current work), then
 * confidence, then recency. Weights are spaced so the order is stable.
 */
function score(entry: MemoryEntry, queryTokens: Set<string>): number {
  const contentTokens = tokenize(entry.content);
  let matches = 0;
  for (const token of contentTokens) {
    if (queryTokens.has(token)) matches += 1;
  }
  const relevance = Math.min(matches, 9); // 0..9
  const scopeBoost = entry.scope === 'project' ? 1 : 0;
  const confidence = Math.max(0, Math.min(1, entry.confidence));
  const recency = (entry.updatedAt ?? entry.createdAt) || '';
  // recency as a tiny fraction (0..1) from the last chars of the timestamp.
  const recencyTiny = recency ? Math.min(1, recency.charCodeAt(recency.length - 1) / 256) : 0;
  return relevance * 1000 + scopeBoost * 100 + confidence * 10 + recencyTiny;
}

/** Returns the memories that should be injected, ranked and size-limited. */
export function recallMemories(entries: MemoryEntry[], options: RecallOptions): MemoryEntry[] {
  if (!options.enabled) return [];
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;

  const queryTokens = new Set(tokenize(options.query));
  const ranked = entries
    .filter((entry) => inScope(entry, options.mode, options.activeProject))
    .map((entry) => ({ entry, value: score(entry, queryTokens) }))
    .sort((a, b) => b.value - a.value);

  const picked: MemoryEntry[] = [];
  let chars = 0;
  for (const { entry } of ranked) {
    if (picked.length >= maxEntries) break;
    const cost = entry.content.length + 1;
    if (chars + cost > maxChars && picked.length > 0) break;
    picked.push(entry);
    chars += cost;
  }
  return picked;
}

function scopeLabel(entry: MemoryEntry): string {
  return entry.scope === 'global' ? 'global' : `projeto:${entry.project ?? '—'}`;
}

/**
 * Builds an explicit, non-opaque memory context attachment. Returns undefined
 * when nothing should be injected (disabled, or no in-scope memories).
 */
export function buildMemoryAttachment(entries: MemoryEntry[], options: RecallOptions): ChatAttachment | undefined {
  const picked = recallMemories(entries, options);
  if (picked.length === 0) return undefined;
  const lines = picked.map((entry) => `- [${scopeLabel(entry)}] ${entry.content.trim()}`);
  const contextText = `[memórias do usuário — use apenas se relevante, não invente além disto]\n${lines.join('\n')}`;
  const previewText = lines.join('\n').slice(0, 800);
  return {
    path: 'memory:recall',
    name: `Memórias (${picked.length})`,
    kind: 'text',
    previewAvailable: true,
    previewTextLimited: previewText,
    contextText,
    contextSource: 'memory',
  };
}
