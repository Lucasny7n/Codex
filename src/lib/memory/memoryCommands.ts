import type { MemoryScope } from '../../types/domain';

/**
 * Deterministic fallback parser for simple memory commands, used in chat
 * pre-processing while AI tool-use is not available. Recognizes a small set of
 * pt-BR phrasings; anything else returns undefined and the message flows to the
 * model normally.
 */
export type MemoryCommand =
  | { type: 'save'; scope: MemoryScope; content: string }
  | { type: 'forget'; query: string }
  | { type: 'recall'; scope: MemoryScope };

function normalize(input: string): string {
  return input.trim().replace(/\s+/gu, ' ');
}

function stripTrailingPunctuation(text: string): string {
  return text.replace(/[.!?;,\s]+$/u, '').trim();
}

const PROJECT_HINT = /(s[óo]|apenas)\s+(neste|nesse|no)\s+projeto|neste projeto|deste projeto/iu;

export function parseMemoryCommand(rawInput: string): MemoryCommand | undefined {
  const input = normalize(rawInput);
  const lower = input.toLowerCase();

  // Recall queries.
  if (/^o que (voc[êe]|tu) (lembra|sabe).*(sobre|de) mim\b/u.test(lower)
    || /^o que (voc[êe]|tu) (lembra|sabe) sobre mim\b/u.test(lower)) {
    return { type: 'recall', scope: 'global' };
  }
  if (/^o que (voc[êe]|tu) (lembra|sabe).*(deste|desse|neste|nesse|do|sobre.*o?) projeto\b/u.test(lower)) {
    return { type: 'recall', scope: 'project' };
  }

  // Forget.
  const forget = input.match(/^(?:esque[çc]a|esquece|apague(?: da mem[óo]ria)?|remova(?: da mem[óo]ria)?)\s+(.+)/iu);
  if (forget) {
    const query = stripTrailingPunctuation(forget[1]);
    if (query) return { type: 'forget', query };
  }

  // Save: "lembre que X", "lembra que X", "salve/salva que X",
  // "salve/salva isso na memória[: X]", "guarde que X".
  const save = input.match(
    /^(?:lembre|lembra|salve|salva|guarde|guarda)\s+(?:que\s+|disso\s+|isso\s+)?(.*)$/iu,
  );
  if (save) {
    const scope: MemoryScope = PROJECT_HINT.test(lower) ? 'project' : 'global';
    let content = save[1] ?? '';
    // Drop a leading "na memória" / "só neste projeto" preamble before content.
    content = content
      .replace(/^na mem[óo]ria[:,]?\s*/iu, '')
      .replace(/^(?:s[óo]|apenas)\s+(?:neste|nesse|no)\s+projeto[:,]?\s*/iu, '')
      .replace(/^neste projeto[:,]?\s*/iu, '');
    content = stripTrailingPunctuation(content);
    return { type: 'save', scope, content };
  }

  return undefined;
}
