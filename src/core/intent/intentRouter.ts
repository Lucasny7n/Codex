import { IntentResult } from './intentTypes';

export function routeIntent(text: string): IntentResult {
  const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const isConversational = ['oi', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'tudo bem'].some(word => lower === word || lower.startsWith(word));

  if (isConversational) {
    return { type: 'conversation', confidence: 0.9, normalizedText: lower };
  }
  if (lower.includes('que dia e hoje') || lower.includes('que dia hoje')) {
    return { type: 'date_time', confidence: 0.9, normalizedText: lower };
  }
  if (lower.includes('o que e zram') || lower.includes('o que e o zram')) {
    return { type: 'explanation', confidence: 0.8, normalizedText: lower, entities: { topic: 'zram' } };
  }
  if (lower.includes('meu pc esta lento') || lower.includes('pc lento')) {
    return { type: 'diagnostic', confidence: 0.8, normalizedText: lower, reason: 'Usuário relatou lentidão no PC.' };
  }
  if (lower.includes('arruma meu bluetooth')) {
    return { type: 'action_plan', confidence: 0.9, normalizedText: lower, entities: { target: 'diagnose-bluetooth' }, requiresApproval: true };
  }
  if (lower.includes('instala heroic')) {
    return { type: 'action_plan', confidence: 0.9, normalizedText: lower, entities: { target: 'install-package', package: 'heroic' }, requiresApproval: true };
  }
  if (lower.includes('esse modelo roda bem')) {
    return { type: 'model_question', confidence: 0.8, normalizedText: lower };
  }
  if (lower.includes('salva essa decisao') || lower.includes('salvar memoria')) {
    return { type: 'memory_save', confidence: 0.9, normalizedText: lower };
  }
  if (lower.includes('configurar airllm')) {
    return { type: 'runtime_help', confidence: 0.8, normalizedText: lower };
  }
  if (lower.includes('ativar voz')) {
    return { type: 'voice_help', confidence: 0.8, normalizedText: lower };
  }

  return { type: 'unknown', confidence: 0.1, normalizedText: lower };
}
