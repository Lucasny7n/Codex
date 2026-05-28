/**
 * Deterministic intent → tool routing (pt-BR), used while AI tool-use is not
 * available natively. Mirrors the memory-command fallback approach. Anything
 * unmatched returns undefined and flows to the model normally.
 */
export function detectToolIntent(rawInput: string): string | undefined {
  const input = rawInput.trim().toLowerCase().replace(/\s+/gu, ' ');

  // System update (elevated). Check first so "atualizar" + "sistema/pacotes"
  // never reads as a query.
  if (/\b(rode?|roda|fa[çc]a|executar?|faz|quero)\b.*\b(update|atualiz\w*)\b/u.test(input)
    || /\b(atualiz\w*|update)\b.*\b(sistema|pacotes|tudo)\b/u.test(input)
    || /^\/?(update|atualiz\w*)\b/u.test(input)) {
    return 'request_system_update';
  }

  // Running processes (read-only). Checked before hardware so "processos …
  // no meu PC" is not swallowed by the hardware rule (which also matches "pc").
  if (/\bprocessos?\b/u.test(input)
    || /\b(o que|quais|que)\b.*\b(rodando|executando|abertos?|consumindo|usando)\b.*\b(pc|m[áa]quina|sistema|cpu|mem[óo]ria|ram)\b/u.test(input)
    || /\b(rodando|executando)\b.*\b(no (meu )?(pc|sistema|m[áa]quina))\b/u.test(input)) {
    return 'list_running_processes';
  }

  // Hardware.
  if (/\b(meu|minha|qual|quais|mostr\w*|ver|detect\w*)\b.*\b(hardware|m[áa]quina|pc|cpu|gpu|placa de v[íi]deo|vram|mem[óo]ria ram)\b/u.test(input)
    || /\bqual (o )?meu hardware\b/u.test(input)) {
    return 'get_hardware_summary';
  }

  // Local models.
  if (/\b(modelos?)\b.*\b(locais|local|instalad\w*|ollama|baixad\w*)\b/u.test(input)
    || /\b(quais|meus|liste?|listar|mostr\w*)\b.*\bmodelos?\b/u.test(input)) {
    return 'list_local_models';
  }

  // Health / diagnostics.
  if (/\b(o que est[áa] errado|diagn[óo]stico|sa[úu]de do sistema|tem algo errado|problemas?)\b/u.test(input)
    || /\b(meu )?sistema\b.*\b(ok|bem|errado|problema)\b/u.test(input)) {
    return 'get_health_status';
  }

  return undefined;
}
