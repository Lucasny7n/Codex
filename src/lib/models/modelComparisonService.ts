import type { ModelComparisonResult, ModelComparisonTarget } from '../../types/domain';

export function parseComparisonTargets(text: string): ModelComparisonTarget[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [identity, profile] = line.split('@').map((part) => part.trim());
      const slash = identity.indexOf('/');
      const providerId = slash > 0 ? identity.slice(0, slash) : identity;
      const modelId = slash > 0 ? identity.slice(slash + 1) : '';
      return {
        providerId,
        modelId,
        accountProfileId: profile || undefined,
        label: `${providerId}/${modelId}`,
      };
    })
    .filter((target) => target.providerId && target.modelId)
    .slice(0, 6);
}

export function comparisonHasPartialFailure(results: ModelComparisonResult[]): boolean {
  return results.some((result) => !result.ok) && results.some((result) => result.ok);
}

export function bestCopyFromComparison(result: ModelComparisonResult): string {
  if (!result.ok) return result.error ?? 'Modelo falhou sem detalhe.';
  return result.content ?? '';
}
