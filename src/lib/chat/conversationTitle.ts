/**
 * Deterministic conversation-title generator (pt-BR first). Used to seed a
 * session title before the optional AI title pass runs. Goal: a short, useful
 * topic — never the raw prompt, never an offensive phrase copied verbatim.
 */

interface IntentRule {
  test: RegExp;
  title: string;
}

// Ordered: first match wins. Keep these conservative — only fire on clear
// signals, otherwise fall back to the generic first-line summary.
const INTENT_RULES: IntentRule[] = [
  { test: /\b(atualiz\w*|update)\b.*\b(sistema|pacotes|tudo)\b|^\/?(update|atualizar)\b/u, title: 'Atualização do sistema' },
  { test: /\bprocessos?\b|\bps aux\b/u, title: 'Processos do sistema' },
  { test: /\b(hardware|cpu|gpu|placa de v[íi]deo|vram|mem[óo]ria ram)\b/u, title: 'Diagnóstico de hardware' },
  { test: /\bmodelos?\b.*\b(locais|local|ollama|instalad\w*|moe)\b|\bmodelos? locais\b/u, title: 'Modelos locais' },
  { test: /\b(o que|quais)\b.*\b(lembra|sabe|salvo|guardad\w*)\b.*\b(mim|sobre eu)\b/u, title: 'Memória do usuário' },
  { test: /\b(sa[úu]de|diagn[óo]stico)\b.*\b(sistema|app|aplicativo)\b/u, title: 'Saúde do sistema' },
];

// Greetings / very short social openers that carry no topic.
const GREETING_RE = /^(oi+|ol[áa]+|e a[íi]+|fala+|opa+|salve+|bom dia+|boa tarde+|boa noite+|hello+|hi+|hey+|test\w*)\b/u;

// Crude/offensive tokens — when the message is essentially a greeting plus an
// insult, summarize the intent instead of copying the slur into the sidebar.
const VULGAR_RE = /\b(cuz[ãa]o|merd\w*|porra+|caralh\w*|fdp|viad\w*|otári\w*|burr\w*|idiot\w*|babaca|arrombad\w*)\b/u;

function titleCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function titleFromContent(content: string): string {
  const stripped = content
    .replace(/```[\s\S]*?```/gu, ' ')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? '';

  const compact = stripped
    .replace(/\s+/gu, ' ')
    .replace(/^[-–—*#>\s]+/u, '')
    .trim();

  if (!compact) {
    return `Conversa ${new Date().toLocaleString('pt-BR')}`;
  }

  const lower = compact.toLowerCase();

  // Intent shortcuts.
  for (const rule of INTENT_RULES) {
    if (rule.test.test(lower)) return rule.title;
  }

  // Greeting (optionally vulgar) with no real topic → summarize tone/intent.
  const words = compact.split(' ');
  const hasVulgar = VULGAR_RE.test(lower);
  if (GREETING_RE.test(lower) && words.length <= 5) {
    return hasVulgar ? 'Teste de tom informal' : 'Saudação em português';
  }
  if (hasVulgar && words.length <= 4) {
    return 'Teste de tom informal';
  }

  // Generic: short topic from the first meaningful line.
  let title = words.slice(0, 7).join(' ');
  if (title.length > 48) {
    title = `${title.slice(0, 45).trim()}…`;
  } else if (words.length > 7) {
    title = `${title}…`;
  }
  return titleCase(title);
}
