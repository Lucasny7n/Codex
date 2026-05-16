import { useMemo, useState } from 'react';
import {
  LLM_CATEGORIES,
  llmResources,
  type LlmResource,
  type LlmResourceCategory,
  type LlmResourceDifficulty,
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
  return `${resource.title} (${resource.provider}, ${resource.year}) - ${resource.url}`;
}

function categoryLabel(category: LlmResourceCategory): string {
  return LLM_CATEGORIES.find((item) => item.id === category)?.label ?? category;
}

function difficultyTone(difficulty: LlmResourceDifficulty): 'neutral' | 'info' | 'warn' {
  if (difficulty === 'beginner') return 'info';
  if (difficulty === 'advanced') return 'warn';
  return 'neutral';
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
  const [openSourceOnly, setOpenSourceOnly] = useState(false);
  const [localFriendlyOnly, setLocalFriendlyOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(readFavorites);
  const [copyStatus, setCopyStatus] = useState<string>();

  const resourceTypes = useMemo(
    () => Array.from(new Set(llmResources.map((resource) => resource.type))).sort(),
    [],
  );

  const results = useMemo(
    () =>
      searchLlmResources(llmResources, {
        query,
        category,
        type,
        difficulty,
        openSourceOnly,
        localFriendlyOnly,
        favorites,
      }),
    [category, difficulty, favorites, localFriendlyOnly, openSourceOnly, query, type],
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
          <option value="all">Todas as categorias</option>
          {LLM_CATEGORIES.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
        <select value={type} aria-label="Filtrar tipo" onChange={(event) => setType(event.target.value as LlmResourceType | 'all')}>
          <option value="all">Todos os tipos</option>
          {resourceTypes.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select value={difficulty} aria-label="Filtrar dificuldade" onChange={(event) => setDifficulty(event.target.value as LlmResourceDifficulty | 'all')}>
          <option value="all">Todas as dificuldades</option>
          <option value="beginner">beginner</option>
          <option value="intermediate">intermediate</option>
          <option value="advanced">advanced</option>
        </select>
      </div>

      <div className="library-filter-row" aria-label="Filtros rápidos">
        <button type="button" className={openSourceOnly ? 'active' : ''} onClick={() => setOpenSourceOnly((current) => !current)}>
          Open source
        </button>
        <button type="button" className={localFriendlyOnly ? 'active' : ''} onClick={() => setLocalFriendlyOnly((current) => !current)}>
          Local friendly
        </button>
        <button type="button" disabled={!query && category === 'all' && type === 'all' && difficulty === 'all' && !openSourceOnly && !localFriendlyOnly} onClick={() => {
          setQuery('');
          setCategory('all');
          setType('all');
          setDifficulty('all');
          setOpenSourceOnly(false);
          setLocalFriendlyOnly(false);
        }}>
          Limpar filtros
        </button>
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
                    <h2>{resource.title}</h2>
                    <p>{resource.provider} · {resource.year}</p>
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
                <p className="library-resource-summary">{resource.summary}</p>
                <div className="library-tag-list">
                  {resource.tags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
                <div className="library-badge-row">
                  <Badge tone={difficultyTone(resource.difficulty)}>{resource.difficulty}</Badge>
                  {resource.isOpenSource ? <Badge tone="ok">open</Badge> : <Badge tone="neutral">closed</Badge>}
                  {resource.localFriendly ? <Badge tone="info">local</Badge> : null}
                  <Badge tone={resource.relevance === 'core' ? 'ok' : 'neutral'}>{resource.relevance}</Badge>
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
