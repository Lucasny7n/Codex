export type InspectorTabId = 'approvals' | 'files' | 'status' | 'settings' | 'prompt';

interface InspectorTabsProps {
  selectedTab: InspectorTabId;
  onSelectTab: (tab: InspectorTabId) => void;
  pendingApprovals: number;
  changedFiles: number;
  statusNotes: number;
}

const TAB_LABELS: Record<InspectorTabId, string> = {
  approvals: 'Aprovações',
  files: 'Arquivos',
  status: 'Status',
  settings: 'Settings',
  prompt: 'Prompt'
};

export function InspectorTabs({
  selectedTab,
  onSelectTab,
  pendingApprovals,
  changedFiles,
  statusNotes
}: InspectorTabsProps): JSX.Element {
  return (
    <nav className="inspector-tabs" aria-label="Abas do inspector">
      {(Object.keys(TAB_LABELS) as InspectorTabId[]).map((tabId) => {
        const count = tabId === 'approvals' ? pendingApprovals : tabId === 'files' ? changedFiles : tabId === 'status' ? statusNotes : 0;
        return (
          <button
            key={tabId}
            type="button"
            className={`inspector-tab${selectedTab === tabId ? ' active' : ''}`}
            onClick={() => onSelectTab(tabId)}
          >
            <span>{TAB_LABELS[tabId]}</span>
            {count > 0 ? <span className="inspector-tab-count">{count}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}
