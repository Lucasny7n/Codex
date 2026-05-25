import { useMemo, useState, type ReactNode } from 'react';
import {
  LLM_CATEGORIES,
  llmResources,
  type LlmResource,
  type LlmResourceCategory,
  type LlmResourceDifficulty,
  type LlmResourceRelevance,
  type LlmResourceStatus,
  type LlmResourceType,
} from '../../data/llm-resources';
import { searchLlmResources } from '../../lib/llmLibrary/search';
import { Badge } from '../common/Badge';
import { UiIcon } from '../common/AppIcons';

interface LlmLibraryPanelProps {
  onExplain: (resource: LlmResource) => void;
  onCompare: (resource: LlmResource) => void;
  onAddToPlan: (resource: LlmResource) => void;
  onUseAsContext: (resource: LlmResource) => void;
}

const FAVORITES_KEY = 'ailu-ai-studio-llm-library-favorites';

function readFavorites(): string[] {
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function writeFavorites(ids: string[]): void {
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
  } catch {
    // Favoritos são conveniência local e não devem bloquear a biblioteca.
  }
}

function resourceReference(resource: LlmResource): string {
  return `${resource.title} (${resource.organization}, ${resource.year}) - ${resource.url}`;
}

function categoryLabel(category: LlmResourceCategory): string {
  return LLM_CATEGORIES.find((item) => item.id === category)?.label ?? category;
}

function difficultyTone(difficulty: LlmResourceDifficulty): 'neutral' | 'info' | 'warn' {
  if (difficulty === 'beginner') return 'info';
  if (difficulty === 'advanced') return 'warn';
  return 'neutral';
}

function statusTone(status: LlmResourceStatus): 'neutral' | 'info' | 'warn' | 'ok' {
  if (status === 'active' || status === 'live') return 'ok';
  if (status === 'foundational') return 'info';
  if (status === 'experimental') return 'warn';
  return 'neutral';
}

function highlightText(value: string, query: string): ReactNode {
  const terms = query.trim().split(/\s+/u).filter((item) => item.length > 2);
  const term = terms[0];
  if (!term) return value;

  const index = value.toLowerCase().indexOf(term.toLowerCase());
  if (index < 0) return value;

  return (
    <>
      {value.slice(0, index)}
      <mark className="library-highlight">{value.slice(index, index + term.length)}</mark>
      {value.slice(index + term.length)}
    </>
  );
}

export function LlmLibraryPanel({
  onExplain,
  onCompare,
  onAddToPlan,
  onUseAsContext,
}: LlmLibraryPanelProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<LlmResourceCategory | 'all'>('all');
  const [type, setType] = useState<LlmResourceType | 'all'>('all');
  const [difficulty, setDifficulty] = useState<LlmResourceDifficulty | 'all'>('all');
  const [organization, setOrganization] = useState<string | 'all'>('all');
  const [selectedTag, setSelectedTag] = useState<string>();
  const [openSourceOnly, setOpenSourceOnly] = useState(false);
  const [localFriendlyOnly, setLocalFriendlyOnly] = useState(false);
  const [coreOnly, setCoreOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(readFavorites);
  const [copyStatus, setCopyStatus] = useState<string>();

  const resourceTypes = useMemo(
    () => Array.from(new Set(llmResources.map((resource) => resource.type))).sort(),
    [],
  );
  const organizations = useMemo(
    () => Array.from(new Set(llmResources.map((resource) => resource.organization))).sort(),
    [],
  );
  const popularTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const resource of llmResources) {
      for (const tag of resource.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 10)
      .map(([tag]) => tag);
  }, []);

  const results = useMemo(
    () =>
      searchLlmResources(llmResources, {
        query,
        category,
        type,
        difficulty,
        organization,
        tag: selectedTag,
        relevance: coreOnly ? 'core' : 'all',
        openSourceOnly,
        localFriendlyOnly,
        favoritesOnly,
        favorites,
      }),
    [category, coreOnly, difficulty, favorites, favoritesOnly, localFriendlyOnly, openSourceOnly, organization, query, selectedTag, type],
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map<LlmResourceCategory, number>();
    for (const resource of llmResources) {
      counts.set(resource.category, (counts.get(resource.category) ?? 0) + 1);
    }
    return counts;
  }, []);

  function toggleFavorite(resourceId: string): void {
    setFavorites((current) => {
      const next = current.includes(resourceId)
        ? current.filter((id) => id !== resourceId)
        : [resourceId, ...current];
      writeFavorites(next);
      return next;
    });
  }

  function copyResource(resource: LlmResource): void {
    void navigator.clipboard?.writeText(resourceReference(resource));
    setCopyStatus(resource.id);
    window.setTimeout(() => setCopyStatus((current) => (current === resource.id ? undefined : current)), 1600);
  }

  const filtersActive = Boolean(
    query ||
    category !== 'all' ||
    type !== 'all' ||
    difficulty !== 'all' ||
    organization !== 'all' ||
    selectedTag ||
    openSourceOnly ||
    localFriendlyOnly ||
    coreOnly ||
    favoritesOnly,
  );

  return (
    <section className="llm-library-panel" aria-label="LLM Library">
      <header className="workspace-view-header">
        <div>
          <span className="workspace-kicker">Knowledge Hub</span>
          <h1>LLM Library</h1>
          <p>Catálogo curado para pesquisa, seleção de modelos, avaliação, inferência e segurança.</p>
        </div>
        <Badge tone="info">{results.length} / {llmResources.length}</Badge>
      </header>

      <div className="llm-library-toolbar">
        <label className="library-search">
          <UiIcon name="search" className="library-search-icon" />
          <input
            value={query}
            placeholder="Buscar por modelo, paper, organização ou tag"
            aria-label="Buscar na LLM Library"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select value={category} aria-label="Filtrar categoria" onChange={(event) => setCategory(event.target.value as LlmResourceCategory | 'all')}>
          <option value="all">Categorias</option>
          {LLM_CATEGORIES.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
        <select value={type} aria-label="Filtrar tipo" onChange={(event) => setType(event.target.value as LlmResourceType | 'all')}>
          <option value="all">Tipos</option>
          {resourceTypes.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select value={difficulty} aria-label="Filtrar dificuldade" onChange={(event) => setDifficulty(event.target.value as LlmResourceDifficulty | 'all')}>
          <option value="all">Dificuldade</option>
          <option value="beginner">beginner</option>
          <option value="intermediate">intermediate</option>
          <option value="advanced">advanced</option>
        </select>
        <select value={organization} aria-label="Filtrar organização" onChange={(event) => setOrganization(event.target.value)}>
          <option value="all">Organização</option>
          {organizations.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>

      <div className="library-filter-row" aria-label="Filtros rápidos">
        <button type="button" className={favoritesOnly ? 'active' : ''} onClick={() => setFavoritesOnly((current) => !current)}>
          Favorites
        </button>
        <button type="button" className={coreOnly ? 'active' : ''} onClick={() => setCoreOnly((current) => !current)}>
          Core
        </button>
        <button type="button" className={openSourceOnly ? 'active' : ''} onClick={() => setOpenSourceOnly((current) => !current)}>
          Open source
        </button>
        <button type="button" className={localFriendlyOnly ? 'active' : ''} onClick={() => setLocalFriendlyOnly((current) => !current)}>
          Local friendly
        </button>
        <button type="button" disabled={!filtersActive} onClick={() => {
          setQuery('');
          setCategory('all');
          setType('all');
          setDifficulty('all');
          setOrganization('all');
          setSelectedTag(undefined);
          setOpenSourceOnly(false);
          setLocalFriendlyOnly(false);
          setCoreOnly(false);
          setFavoritesOnly(false);
        }}>
          Limpar filtros
        </button>
      </div>

      <div className="library-tag-row" aria-label="Tags populares">
        {popularTags.map((tag) => (
          <button
            key={tag}
            type="button"
            className={selectedTag === tag ? 'active' : ''}
            onClick={() => setSelectedTag((current) => (current === tag ? undefined : tag))}
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="llm-library-layout">
        <aside className="library-category-rail" aria-label="Categorias LLM">
          <button type="button" className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>
            <span>Tudo</span>
            <small>{llmResources.length}</small>
          </button>
          {LLM_CATEGORIES.map((item) => (
            <button key={item.id} type="button" className={category === item.id ? 'active' : ''} onClick={() => setCategory(item.id)}>
              <span>{item.label}</span>
              <small>{categoryCounts.get(item.id) ?? 0}</small>
            </button>
          ))}
        </aside>

        <div className="library-resource-grid scroll-y">
          {results.length === 0 ? (
            <div className="empty-state empty-state-inline library-empty">
              <strong>Nenhum recurso encontrado</strong>
              <span>Ajuste a busca ou remova filtros para ampliar o catálogo.</span>
            </div>
          ) : null}
          {results.map((resource) => {
            const favorite = favorites.includes(resource.id);
            return (
              <article key={resource.id} className={`library-resource-card relevance-${resource.relevance}`}>
                <header>
                  <div>
                    <span className="library-resource-meta">{categoryLabel(resource.category)} · {resource.type}</span>
                    <h2>{highlightText(resource.title, query)}</h2>
                    <p>{resource.organization} · {resource.year}</p>
                  </div>
                  <button
                    type="button"
                    className={`library-favorite ${favorite ? 'active' : ''}`}
                    aria-label={favorite ? `Remover ${resource.title} dos favoritos` : `Favoritar ${resource.title}`}
                    onClick={() => toggleFavorite(resource.id)}
                  >
                    <UiIcon name="spark" />
                  </button>
                </header>
                <p className="library-resource-summary">{highlightText(resource.summary, query)}</p>
                <div className="library-tag-list">
                  {resource.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={selectedTag === tag ? 'active' : ''}
                      onClick={() => setSelectedTag((current) => (current === tag ? undefined : tag))}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <div className="library-badge-row">
                  <Badge tone={difficultyTone(resource.difficulty)}>{resource.difficulty}</Badge>
                  {resource.isOpenSource ? <Badge tone="ok">open</Badge> : <Badge tone="neutral">closed</Badge>}
                  {resource.localFriendly ? <Badge tone="info">local</Badge> : null}
                  <Badge tone={resource.relevance === 'core' ? 'ok' : 'neutral'}>{resource.relevance as LlmResourceRelevance}</Badge>
                  <Badge tone={statusTone(resource.status)}>{resource.status}</Badge>
                </div>
                <footer>
                  <button type="button" onClick={() => onExplain(resource)}>Explain</button>
                  <button type="button" onClick={() => onCompare(resource)}>Compare</button>
                  <button type="button" onClick={() => onAddToPlan(resource)}>Add to plan</button>
                  <button type="button" onClick={() => onUseAsContext(resource)}>Use as context</button>
                  <button type="button" onClick={() => copyResource(resource)}>
                    {copyStatus === resource.id ? 'Copied' : 'Copy ref'}
                  </button>
                  <button type="button" onClick={() => window.open(resource.url, '_blank', 'noopener,noreferrer')}>
                    Open
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
