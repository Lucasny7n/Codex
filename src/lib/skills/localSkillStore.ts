import type { RiskLevel, SkillCategory } from '../../types/domain';

/**
 * Local, persistent fallback store for user-created/imported skills.
 *
 * The Tauri backend exposes only read/plan/test for repository skills
 * (`list_skills`, `plan_skill`, `test_skill_in_vm`); there is no command to
 * create or persist a skill yet. Until that exists, skills the user authors or
 * imports through Skill Studio are kept here in localStorage so they survive
 * reloads. These local skills are inert: they store the script/manifest text
 * and a simulated dry-run preview, and they NEVER execute — running a skill for
 * real still requires the backend runner plus explicit approval.
 */

const LOCAL_SKILLS_KEY = 'ailu-ai-studio-local-skills';

export type LocalSkillOrigin = 'manual' | 'import';

export interface LocalSkill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  riskLevel: RiskLevel;
  permissions: string[];
  content: string;
  origin: LocalSkillOrigin;
  createdAt: string;
}

function safeParse(raw: string | null): LocalSkill[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is LocalSkill =>
      Boolean(item)
      && typeof item === 'object'
      && typeof (item as LocalSkill).id === 'string'
      && typeof (item as LocalSkill).name === 'string'
      && typeof (item as LocalSkill).content === 'string',
    );
  } catch {
    return [];
  }
}

export function readLocalSkills(): LocalSkill[] {
  try {
    return safeParse(window.localStorage?.getItem(LOCAL_SKILLS_KEY) ?? null);
  } catch {
    return [];
  }
}

function persist(skills: LocalSkill[]): void {
  try {
    window.localStorage?.setItem(LOCAL_SKILLS_KEY, JSON.stringify(skills));
  } catch {
    // Persistence is best-effort; the in-memory list still works this session.
  }
}

function newId(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '').slice(0, 32) || 'skill';
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Date.now().toString(36);
  return `local-${slug}-${suffix}`;
}

export interface SaveLocalSkillInput {
  name: string;
  description: string;
  content: string;
  category?: SkillCategory;
  riskLevel?: RiskLevel;
  permissions?: string[];
  origin?: LocalSkillOrigin;
}

export function saveLocalSkill(input: SaveLocalSkillInput): LocalSkill {
  const skill: LocalSkill = {
    id: newId(input.name),
    name: input.name.trim(),
    description: input.description.trim(),
    category: input.category ?? 'other',
    riskLevel: input.riskLevel ?? 'medium',
    permissions: input.permissions ?? [],
    content: input.content,
    origin: input.origin ?? 'manual',
    createdAt: new Date().toISOString(),
  };
  persist([skill, ...readLocalSkills()]);
  return skill;
}

export function deleteLocalSkill(id: string): LocalSkill[] {
  const next = readLocalSkills().filter((skill) => skill.id !== id);
  persist(next);
  return next;
}

/**
 * Best-effort parse of pasted/imported content into a skill draft. Detects a
 * JSON manifest vs a shell script and infers risk from the script body. Returns
 * the draft plus a human-readable validation note; never throws.
 */
export interface ParsedSkillDraft {
  draft: SaveLocalSkillInput;
  notes: string[];
  ok: boolean;
}

const RISKY_TOKENS = /\b(rm\s+-rf|mkfs|dd\s+if=|sudo|pacman\s+-R|chmod\s+777|:\s*\(\)\s*\{)/u;

export function parseSkillContent(raw: string, fallbackName = 'Skill importada'): ParsedSkillDraft {
  const text = raw.trim();
  const notes: string[] = [];
  if (!text) {
    return { draft: { name: fallbackName, description: '', content: '' }, notes: ['Conteúdo vazio.'], ok: false };
  }

  // JSON manifest?
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const name = typeof parsed.name === 'string' ? parsed.name : fallbackName;
    const description = typeof parsed.description === 'string' ? parsed.description : '';
    const category = (typeof parsed.category === 'string' ? parsed.category : 'other') as SkillCategory;
    const riskLevel = (typeof parsed.riskLevel === 'string' ? parsed.riskLevel : 'medium') as RiskLevel;
    const permissions = Array.isArray(parsed.permissions)
      ? parsed.permissions.filter((p): p is string => typeof p === 'string')
      : [];
    notes.push('Manifest JSON reconhecido.');
    if (!description) notes.push('Sem descrição — adicione antes de salvar.');
    return {
      draft: { name, description, content: text, category, riskLevel, permissions, origin: 'import' },
      notes,
      ok: Boolean(name),
    };
  } catch {
    // Not JSON — treat as a script.
  }

  const lines = text.split('\n');
  const hasShebang = lines[0]?.startsWith('#!') ?? false;
  const hasDryRun = /--dry-run|DRY_RUN/u.test(text);
  const risky = RISKY_TOKENS.test(text);
  notes.push(`Script detectado${hasShebang ? ` (${lines[0]})` : ''}.`);
  notes.push(hasDryRun ? 'Dry-run encontrado no script.' : 'Sem dry-run no script — o teste será apenas simulado.');
  if (risky) notes.push('Atenção: comandos potencialmente destrutivos detectados. Revise com cuidado.');
  return {
    draft: {
      name: fallbackName,
      description: '',
      content: text,
      category: 'other',
      riskLevel: risky ? 'high' : 'medium',
      permissions: [],
      origin: 'import',
    },
    notes,
    ok: true,
  };
}

/** A clearly-simulated dry-run preview — shows what WOULD run, never executes. */
export function simulateDryRun(skill: LocalSkill): string {
  return [
    `# Dry-run simulado de "${skill.name}"`,
    `# Risco: ${skill.riskLevel} · Categoria: ${skill.category}`,
    skill.permissions.length ? `# Permissões: ${skill.permissions.join(', ')}` : '# Permissões: nenhuma declarada',
    '# Nada é executado. Execução real exige backend + aprovação explícita.',
    '',
    skill.content.trim(),
  ].join('\n');
}
