import type { AiFallbackModelConfig, AiFallbackPolicy } from '../types/domain';

export interface AiRouteCandidate {
  providerId: string;
  modelId: string;
  accountProfileId?: string;
}

export function buildFallbackPlan(
  primary: AiRouteCandidate,
  fallbackModels: AiFallbackModelConfig[],
  policy: AiFallbackPolicy,
  developerMode: boolean,
  fallbackEnabled: boolean,
): AiRouteCandidate[] {
  const plan: AiRouteCandidate[] = [primary];
  if (!developerMode || !fallbackEnabled) return plan;

  const ordered = fallbackModels
    .filter((model) => model.enabled)
    .filter((model) => model.providerId !== primary.providerId || model.modelId !== primary.modelId || model.accountProfileId !== primary.accountProfileId)
    .map((model) => ({
      providerId: model.providerId,
      modelId: model.modelId,
      accountProfileId: model.accountProfileId,
    }))
    .sort((left, right) => policyScore(left, policy) - policyScore(right, policy));

  for (const candidate of ordered) {
    if (!plan.some((item) => item.providerId === candidate.providerId && item.modelId === candidate.modelId && item.accountProfileId === candidate.accountProfileId)) {
      plan.push(candidate);
    }
  }
  return plan;
}

function policyScore(candidate: AiRouteCandidate, policy: AiFallbackPolicy): number {
  const local = candidate.providerId === 'local-ollama';
  const model = candidate.modelId.toLowerCase();
  if (policy === 'local_first') return local ? 0 : 1;
  if (policy === 'cloud_first') return local ? 1 : 0;
  if (policy === 'fast_first') return /mini|flash|haiku|3b|1\.5b/u.test(model) ? 0 : 1;
  if (policy === 'code') return /coder|code|codestral|devstral/u.test(model) ? 0 : 1;
  return 0;
}
