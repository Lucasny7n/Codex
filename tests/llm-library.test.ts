import { describe, expect, it } from 'vitest';
import { LLM_CATEGORIES, llmResources } from '../src/data/llm-resources';
import { searchLlmResources } from '../src/lib/llmLibrary/search';

describe('LLM Library catalog', () => {
  it('keeps a curated subset with stable metadata', () => {
    expect(llmResources.length).toBeGreaterThanOrEqual(24);
    for (const resource of llmResources) {
      expect(resource.id).toMatch(/^[a-z0-9-]+$/);
      expect(resource.title.length).toBeGreaterThan(2);
      expect(resource.url).toMatch(/^https?:\/\//u);
      expect(resource.organization.length).toBeGreaterThan(1);
      expect(resource.summary.length).toBeGreaterThan(32);
      expect(resource.tags.length).toBeGreaterThan(0);
      expect(resource.status).toMatch(/^(foundational|active|live|reference|experimental|archived)$/u);
      expect(resource.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    }
  });

  it('covers all requested product categories', () => {
    const configured = new Set(LLM_CATEGORIES.map((category) => category.id));
    const resources = new Set(llmResources.map((resource) => resource.category));
    for (const category of configured) {
      expect(resources.has(category), `${category} should have at least one resource`).toBe(true);
    }
  });

  it('searches human terms and keeps local filters separate', () => {
    const qwen = searchLlmResources(llmResources, { query: 'qwen coder', category: 'all' });
    expect(qwen[0]?.id).toBe('qwen25-coder');

    const local = searchLlmResources(llmResources, { query: 'local inference', localFriendlyOnly: true });
    expect(local.length).toBeGreaterThan(0);
    expect(local.every((resource) => resource.localFriendly)).toBe(true);

    const cloudBenchmarks = searchLlmResources(llmResources, { category: 'leaderboards', localFriendlyOnly: false });
    expect(cloudBenchmarks.some((resource) => resource.type === 'leaderboard')).toBe(true);
  });

  it('filters by organization, tags and favorites without changing catalog truth', () => {
    const stanford = searchLlmResources(llmResources, { organization: 'Stanford NLP' });
    expect(stanford.some((resource) => resource.id === 'dspy')).toBe(true);
    expect(stanford.every((resource) => resource.organization === 'Stanford NLP')).toBe(true);

    const rag = searchLlmResources(llmResources, { tag: 'rag' });
    expect(rag.some((resource) => resource.category === 'rag')).toBe(true);

    const favorites = searchLlmResources(llmResources, {
      favoritesOnly: true,
      favorites: ['retrieval-augmented-generation'],
    });
    expect(favorites).toHaveLength(1);
    expect(favorites[0]?.id).toBe('retrieval-augmented-generation');
  });

  it('ranks favorites before otherwise similar resources', () => {
    const results = searchLlmResources(llmResources, {
      query: 'evaluation',
      favorites: ['lm-evaluation-harness'],
    });
    expect(results[0]?.id).toBe('lm-evaluation-harness');
  });
});
