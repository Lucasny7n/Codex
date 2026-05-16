import type {
  LlmResource,
  LlmResourceCategory,
  LlmResourceDifficulty,
  LlmResourceType,
} from '../../data/llm-resources';

export interface LlmResourceFilters {
  query?: string;
  category?: LlmResourceCategory | 'all';
  type?: LlmResourceType | 'all';
  difficulty?: LlmResourceDifficulty | 'all';
  openSourceOnly?: boolean;
  localFriendlyOnly?: boolean;
  favorites?: string[];
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '');
}

function resourceHaystack(resource: LlmResource): string {
  return normalize([
    resource.title,
    resource.provider,
    resource.category,
    resource.type,
    resource.year,
    resource.summary,
    resource.tags.join(' '),
  ].join(' '));
}

function scoreResource(resource: LlmResource, query: string, favorites: Set<string>): number {
  let score = 0;
  if (favorites.has(resource.id)) score += 30;
  if (resource.relevance === 'core') score += 20;
  if (resource.relevance === 'high') score += 10;
  if (resource.localFriendly) score += 4;
  if (!query) return score;

  const normalizedTitle = normalize(resource.title);
  const normalizedProvider = normalize(resource.provider);
  const normalizedTags = normalize(resource.tags.join(' '));
  const terms = normalize(query).split(/\s+/u).filter(Boolean);

  for (const term of terms) {
    if (normalizedTitle.includes(term)) score += 18;
    if (normalizedProvider.includes(term)) score += 8;
    if (normalizedTags.includes(term)) score += 12;
    if (resourceHaystack(resource).includes(term)) score += 4;
  }

  return score;
}

export function searchLlmResources(resources: LlmResource[], filters: LlmResourceFilters): LlmResource[] {
  const query = filters.query?.trim() ?? '';
  const terms = normalize(query).split(/\s+/u).filter(Boolean);
  const favorites = new Set(filters.favorites ?? []);

  return resources
    .filter((resource) => {
      if (filters.category && filters.category !== 'all' && resource.category !== filters.category) return false;
      if (filters.type && filters.type !== 'all' && resource.type !== filters.type) return false;
      if (filters.difficulty && filters.difficulty !== 'all' && resource.difficulty !== filters.difficulty) return false;
      if (filters.openSourceOnly && !resource.isOpenSource) return false;
      if (filters.localFriendlyOnly && !resource.localFriendly) return false;
      if (terms.length === 0) return true;
      const haystack = resourceHaystack(resource);
      return terms.every((term) => haystack.includes(term));
    })
    .sort((left, right) => {
      const scoreDelta = scoreResource(right, query, favorites) - scoreResource(left, query, favorites);
      if (scoreDelta !== 0) return scoreDelta;
      return left.title.localeCompare(right.title);
    });
}
