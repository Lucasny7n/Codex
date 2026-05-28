/**
 * Deterministic conversation-title generator (pt-BR first). Used to seed a
 * session title before the optional AI title pass runs, and to sanitize any
 * AI-generated title. Goal: a short, useful topic — never the raw prompt, never
 * an offensive phrase copied verbatim.
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
  { test: /\b(erro|falha|bug|n[ãa]o funciona|quebr\w*|trav\w*|crash)\b/u, title: 'Relato de problema' },
];

// Greetings / very short social openers that carry no topic.
const GREETING_RE = /^(oi+|ol[áa]+|e a[íi]+|fala+|opa+|salve+|bom dia+|boa tarde+|boa noite+|hello+|hi+|hey+|test\w*)\b/u;

// Offensive / crude / sexual / slur tokens (pt-BR + en, stem-based). If any
// appears anywhere in the message, the title is summarized neutrally and the
// term is never copied into the sidebar.
const OFFENSIVE_RE = new RegExp(
  [
    'cuz[ãa]o', 'merd\\w*', 'porra+', 'caralh\\w*', 'fdp', 'viad\\w*', 'ot[áa]ri\\w*',
    'burr[oa]s?', 'idiot\\w*', 'babac\\w*', 'arrombad\\w*', 'put[ao]s?', 'bucet\\w*',
    'fod[ae]\\w*', 'foda-?se', 'piroc\\w*', 'corn[oa]s?', 'desgra[çc]\\w*', 'vagabund\\w*',
    'retardad\\w*', 'imbecil', 'escrot\\w*', 'viadinh\\w*', 'bich[a]s?', 'travec\\w*',
    'pints?', 'p[êe]nis', 'cacet\\w*', 'fud\\w*',
    'fuck\\w*', 'shit\\w*', 'bitch\\w*', 'asshole\\w*', 'dick\\w*', 'cunt\\w*',
    'slut\\w*', 'whore\\w*', 'retard\\w*', 'fagg?\\w*', 'pussy', 'bastard\\w*', 'nigg\\w*',
  ].join('|'),
  'iu',
);

const NEUTRAL_INFORMAL_TITLE = 'Teste de linguagem informal';

export function containsOffensive(text: string): boolean {
  return OFFENSIVE_RE.test(text) || /\bcu\b/iu.test(text);
}

function titleCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Cleans an arbitrary (possibly AI-generated) title: rejects offensive content,
 * strips noise, caps length. Returns undefined when nothing usable remains so
 * the caller can fall back to a deterministic title.
 */
export function sanitizeTitle(raw: string): string | undefined {
  const compact = raw
    .replace(/```[\s\S]*?```/gu, ' ')
    .replace(/[\r\n]+/gu, ' ')
    .replace(/^["'«»]+|["'«»]+$/gu, '')
    .replace(/[.!?,:;-]+$/gu, '')
    .replace(/\s+/gu, ' ')
    .replace(/^[-–—*#>\s]+/u, '')
    .trim();
  if (!compact) return undefined;
  if (containsOffensive(compact)) return NEUTRAL_INFORMAL_TITLE;
  const words = compact.split(' ');
  let title = words.slice(0, 7).join(' ');
  if (title.length > 48) {
    title = `${title.slice(0, 45).trim()}…`;
  } else if (words.length > 7) {
    title = `${title}…`;
  }
  return titleCase(title);
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

  // Offensive content anywhere → never copy it; summarize the intent neutrally.
  if (containsOffensive(lower)) {
    return NEUTRAL_INFORMAL_TITLE;
  }

  // Intent shortcuts.
  for (const rule of INTENT_RULES) {
    if (rule.test.test(lower)) return rule.title;
  }

  // Greeting with no real topic → neutral.
  const words = compact.split(' ');
  if (GREETING_RE.test(lower) && words.length <= 5) {
    return 'Saudação em português';
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
