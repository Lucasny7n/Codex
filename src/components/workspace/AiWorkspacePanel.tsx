import { useMemo, useState } from 'react';
import { Badge } from '../common/Badge';
import { UiIcon } from '../common/AppIcons';
import type {
  FileChangeEntry,
  PermissionRequest,
  ProviderDescriptor,
  StatusNote,
} from '../../types/domain';

export type WorkspacePlanStatus = 'todo' | 'doing' | 'done' | 'blocked';

export interface WorkspacePlanItem {
  id: string;
  title: string;
  status: WorkspacePlanStatus;
  detail?: string;
  source?: string;
}

interface AiWorkspacePanelProps {
  workspaceRoot?: string;
  providers: ProviderDescriptor[];
  pendingPermissions: PermissionRequest[];
  changedFiles: FileChangeEntry[];
  statusFeed: StatusNote[];
  planItems: WorkspacePlanItem[];
  terminalEnabled: boolean;
  webPreviewEnabled: boolean;
  onOpenTerminal: () => void;
  onPlanChange: (items: WorkspacePlanItem[]) => void;
  onExportPlan: (markdown: string) => void;
}

const STATUS_LABELS: Record<WorkspacePlanStatus, string> = {
  todo: 'todo',
  doing: 'doing',
  done: 'done',
  blocked: 'blocked',
};

function statusTone(status: WorkspacePlanStatus): 'neutral' | 'info' | 'ok' | 'danger' {
  if (status === 'doing') return 'info';
  if (status === 'done') return 'ok';
  if (status === 'blocked') return 'danger';
  return 'neutral';
}

function buildPlanMarkdown(items: WorkspacePlanItem[]): string {
  const lines = ['# Ailu Workspace Plan', ''];
  if (items.length === 0) {
    lines.push('- [ ] Nenhuma tarefa planejada.');
    return lines.join('\n');
  }

  for (const item of items) {
    const checked = item.status === 'done' ? 'x' : ' ';
    const suffix = item.status === 'todo' ? '' : ` (${item.status})`;
    lines.push(`- [${checked}] ${item.title}${suffix}`);
    if (item.detail) lines.push(`  - ${item.detail}`);
    if (item.source) lines.push(`  - Source: ${item.source}`);
  }
  return lines.join('\n');
}

export function AiWorkspacePanel({
  workspaceRoot,
  providers,
  pendingPermissions,
  changedFiles,
  statusFeed,
  planItems,
  terminalEnabled,
  webPreviewEnabled,
  onOpenTerminal,
  onPlanChange,
  onExportPlan,
}: AiWorkspacePanelProps): JSX.Element {
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDetail, setDraftDetail] = useState('');
  const readyProviders = useMemo(
    () => providers.filter((provider) => provider.status.state === 'ready'),
    [providers],
  );
  const providersNeedingAction = useMemo(
    () => providers.filter((provider) => provider.status.state !== 'ready').slice(0, 5),
    [providers],
  );

  function addPlanItem(): void {
    const title = draftTitle.trim();
    if (!title) return;
    onPlanChange([
      {
        id: `plan-${Date.now()}`,
        title,
        detail: draftDetail.trim() || undefined,
        status: 'todo',
      },
      ...planItems,
    ]);
    setDraftTitle('');
    setDraftDetail('');
  }

  function updateStatus(itemId: string, status: WorkspacePlanStatus): void {
    onPlanChange(planItems.map((item) => (item.id === itemId ? { ...item, status } : item)));
  }

  function removeItem(itemId: string): void {
    onPlanChange(planItems.filter((item) => item.id !== itemId));
  }

  return (
    <section className="ai-workspace-panel" aria-label="AI Workspace">
      <header className="workspace-view-header">
        <div>
          <span className="workspace-kicker">Command Center</span>
          <h1>AI Workspace</h1>
          <p>Planos, aprovações e contexto de projeto em uma superfície única, sem executar ações sem confirmação.</p>
        </div>
        <div className="workspace-header-actions">
          <Badge tone={readyProviders.length > 0 ? 'ok' : 'warn'}>{readyProviders.length} providers ready</Badge>
          <button type="button" className="btn-modern" onClick={() => onExportPlan(buildPlanMarkdown(planItems))}>
            Export plan
          </button>
        </div>
      </header>

      <div className="ai-workspace-grid">
        <section className="workspace-module workspace-module-primary">
          <header>
            <span><UiIcon name="check" /> Plans & tasks</span>
            <Badge tone="info">{planItems.length}</Badge>
          </header>
          <div className="workspace-plan-composer">
            <input
              value={draftTitle}
              placeholder="Nova tarefa"
              aria-label="Nova tarefa do plano"
              onChange={(event) => setDraftTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addPlanItem();
              }}
            />
            <input
              value={draftDetail}
              placeholder="Detalhe opcional"
              aria-label="Detalhe da tarefa"
              onChange={(event) => setDraftDetail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addPlanItem();
              }}
            />
            <button type="button" className="btn-modern btn-modern-primary" disabled={!draftTitle.trim()} onClick={addPlanItem}>
              Add
            </button>
          </div>
          <div className="workspace-plan-list scroll-y">
            {planItems.length === 0 ? (
              <div className="empty-state empty-state-inline">
                <strong>Sem plano ativo</strong>
                <span>Adicione tarefas manualmente ou envie recursos da LLM Library para cá.</span>
              </div>
            ) : null}
            {planItems.map((item) => (
              <article key={item.id} className={`workspace-plan-row plan-${item.status}`}>
                <div>
                  <strong>{item.title}</strong>
                  {item.detail ? <p>{item.detail}</p> : null}
                  {item.source ? <small>{item.source}</small> : null}
                </div>
                <div>
                  <select value={item.status} aria-label={`Status de ${item.title}`} onChange={(event) => updateStatus(item.id, event.target.value as WorkspacePlanStatus)}>
                    {(Object.keys(STATUS_LABELS) as WorkspacePlanStatus[]).map((status) => (
                      <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                    ))}
                  </select>
                  <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                  <button type="button" className="icon-button" aria-label={`Remover ${item.title}`} onClick={() => removeItem(item.id)}>
                    ×
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="workspace-module">
          <header>
            <span><UiIcon name="spark" /> Provider routing</span>
            <Badge tone={readyProviders.length > 0 ? 'ok' : 'warn'}>{readyProviders.length}/{providers.length}</Badge>
          </header>
          <div className="workspace-provider-list">
            {readyProviders.slice(0, 4).map((provider) => (
              <div key={provider.id} className="workspace-provider-row ready">
                <strong>{provider.label}</strong>
                <span>{provider.status.message}</span>
              </div>
            ))}
            {providersNeedingAction.map((provider) => (
              <div key={provider.id} className="workspace-provider-row">
                <strong>{provider.label}</strong>
                <span>{provider.status.message}</span>
              </div>
            ))}
            {providers.length === 0 ? <p className="workspace-muted">Nenhum provider carregado ainda.</p> : null}
          </div>
        </section>

        <section className="workspace-module">
          <header>
            <span><UiIcon name="folder" /> Project memory</span>
            <Badge tone={workspaceRoot ? 'info' : 'warn'}>{workspaceRoot ? 'loaded' : 'missing'}</Badge>
          </header>
          <div className="workspace-memory-box">
            <strong>AILU.md</strong>
            <p>Arquivo de memória e regras do projeto para orientar a IA sem copiar contexto bruto para o composer.</p>
            <code>{workspaceRoot ? `${workspaceRoot}/AILU.md` : 'workspace não carregado'}</code>
          </div>
        </section>

        <section className="workspace-module">
          <header>
            <span><UiIcon name="check" /> Approvals</span>
            <Badge tone={pendingPermissions.length > 0 ? 'warn' : 'ok'}>{pendingPermissions.length}</Badge>
          </header>
          <div className="workspace-approval-list">
            {pendingPermissions.length === 0 ? <p className="workspace-muted">Nenhuma ação aguardando aprovação.</p> : null}
            {pendingPermissions.slice(0, 5).map((request) => (
              <article key={request.id}>
                <strong>{request.title}</strong>
                <span>{request.category} · risco {request.riskLevel}</span>
                <p>{request.reason}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="workspace-module">
          <header>
            <span><UiIcon name="fileText" /> File context</span>
            <Badge tone={changedFiles.length > 0 ? 'info' : 'neutral'}>{changedFiles.length}</Badge>
          </header>
          <div className="workspace-change-list">
            {changedFiles.length === 0 ? <p className="workspace-muted">Sem alterações detectadas nesta sessão.</p> : null}
            {changedFiles.slice(0, 6).map((change) => (
              <div key={`${change.path}-${change.at}`}>
                <strong>{change.event}</strong>
                <span>{change.path}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="workspace-module">
          <header>
            <span><UiIcon name="desktop" /> Terminal & preview</span>
            <Badge tone={terminalEnabled || webPreviewEnabled ? 'info' : 'neutral'}>experimental</Badge>
          </header>
          <div className="workspace-action-stack">
            <button type="button" className="btn-modern" disabled={!terminalEnabled} onClick={onOpenTerminal}>
              Abrir terminal
            </button>
            <div className="workspace-preview-box">
              <strong>Web preview</strong>
              <span>{webPreviewEnabled ? 'Preparado para detectar URLs locais quando o backend desktop expuser a lista.' : 'Desativado por feature flag.'}</span>
            </div>
          </div>
        </section>

        <section className="workspace-module">
          <header>
            <span><UiIcon name="refresh" /> Runtime notes</span>
            <Badge tone={statusFeed.length > 0 ? 'info' : 'neutral'}>{statusFeed.length}</Badge>
          </header>
          <div className="workspace-status-feed">
            {statusFeed.length === 0 ? <p className="workspace-muted">Sem eventos recentes.</p> : null}
            {statusFeed.slice(0, 5).map((note) => (
              <article key={note.id}>
                <strong>{note.kind}</strong>
                <span>{note.title}</span>
                <p>{note.detail}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
