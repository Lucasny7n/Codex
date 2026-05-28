import type { RiskLevel, SkillCategory, UserSkillInput } from '../../types/domain';

/**
 * Pure, safe parser for pasted/imported skill content. Persistence now lives in
 * the Rust backend (user_skills.json via Tauri commands); this module only
 * inspects content to build a draft + human-readable validation notes. It never
 * executes anything.
 */

export interface ParsedSkillDraft {
  draft: UserSkillInput;
  notes: string[];
  ok: boolean;
}

const RISKY_TOKENS = /\b(rm\s+-rf|mkfs|dd\s+if=|sudo|pacman\s+-R|chmod\s+777|:\s*\(\)\s*\{)/u;

export function parseSkillContent(raw: string, fallbackName = 'Skill importada'): ParsedSkillDraft {
  const text = raw.trim();
  const notes: string[] = [];
  if (!text) {
    return { draft: { name: fallbackName, content: '' }, notes: ['Conteúdo vazio.'], ok: false };
  }

  // JSON manifest?
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const name = typeof parsed.name === 'string' ? parsed.name : fallbackName;
    const description = typeof parsed.description === 'string' ? parsed.description : '';
    const riskLevel = (typeof parsed.riskLevel === 'string' ? parsed.riskLevel : typeof parsed.risk === 'string' ? parsed.risk : 'medium') as RiskLevel;
    const permissions = Array.isArray(parsed.permissions)
      ? parsed.permissions.filter((p): p is string => typeof p === 'string')
      : [];
    notes.push('Manifest JSON reconhecido.');
    if (!description) notes.push('Sem descrição — adicione antes de salvar.');
    return {
      draft: { name, description, content: text, risk: riskLevel, permissions, source: 'import' },
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
      risk: risky ? 'high' : 'medium',
      permissions: [],
      source: 'import',
    },
    notes,
    ok: true,
  };
}

// Kept for callers that still reference the category default.
export const DEFAULT_SKILL_CATEGORY: SkillCategory = 'other';
