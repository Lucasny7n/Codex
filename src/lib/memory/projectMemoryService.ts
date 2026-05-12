import type { ChatAttachment } from '../../types/domain';

export interface ProjectMemoryRecord {
  project: string;
  enabled: boolean;
  summary: string;
  updatedAt?: string;
}

const PROJECT_MEMORY_PREFIX = 'codex-command-center-project-memory:';
const MEMORY_LIMIT = 1_200;

export function projectMemoryKey(project: string): string {
  return `${PROJECT_MEMORY_PREFIX}${project}`;
}

export function readProjectMemory(project: string): ProjectMemoryRecord {
  try {
    const raw = window.localStorage?.getItem(projectMemoryKey(project));
    const parsed: unknown = raw ? JSON.parse(raw) : undefined;
    if (!parsed || typeof parsed !== 'object') {
      return { project, enabled: true, summary: '' };
    }
    const candidate = parsed as Partial<ProjectMemoryRecord>;
    return {
      project,
      enabled: candidate.enabled !== false,
      summary: typeof candidate.summary === 'string' ? candidate.summary.slice(0, MEMORY_LIMIT) : '',
      updatedAt: candidate.updatedAt,
    };
  } catch {
    return { project, enabled: true, summary: '' };
  }
}

export function writeProjectMemory(record: ProjectMemoryRecord): ProjectMemoryRecord {
  const next = {
    project: record.project,
    enabled: record.enabled,
    summary: compactMemory(record.summary),
    updatedAt: new Date().toISOString(),
  };
  window.localStorage?.setItem(projectMemoryKey(record.project), JSON.stringify(next));
  return next;
}

export function setProjectMemoryEnabled(project: string, enabled: boolean): ProjectMemoryRecord {
  return writeProjectMemory({ ...readProjectMemory(project), enabled });
}

export function clearProjectMemory(project: string): ProjectMemoryRecord {
  return writeProjectMemory({ project, enabled: true, summary: '' });
}

export function updateProjectMemoryFromExchange(project: string, userText: string, assistantText: string): ProjectMemoryRecord {
  const current = readProjectMemory(project);
  if (!current.enabled) return current;
  const facts = [
    current.summary,
    `Última solicitação: ${userText.trim().slice(0, 260)}`,
    `Resposta útil: ${assistantText.trim().slice(0, 360)}`,
  ].filter(Boolean).join('\n');
  return writeProjectMemory({ ...current, summary: facts });
}

export function buildProjectMemoryAttachment(project: string, instructions?: string): ChatAttachment | undefined {
  const memory = readProjectMemory(project);
  if (!memory.enabled && !instructions?.trim()) return undefined;
  const blocks = [
    instructions?.trim() ? `[instruções do projeto]\n${instructions.trim()}` : undefined,
    memory.enabled && memory.summary.trim() ? `[memória curta do projeto]\n${memory.summary.trim()}` : undefined,
  ].filter(Boolean);
  if (blocks.length === 0) return undefined;
  return {
    path: `project-memory:${project}`,
    name: `Memória do projeto: ${project}`,
    kind: 'text',
    previewAvailable: false,
    hidden: true,
    contextSource: 'project_memory',
    contextText: blocks.join('\n\n'),
  };
}

function compactMemory(value: string): string {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .slice(-MEMORY_LIMIT);
}
