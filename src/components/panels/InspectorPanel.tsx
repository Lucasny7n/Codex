import type { ReactNode } from 'react';
import { InspectorTabs, type InspectorTabId } from '../layout/InspectorTabs';

interface InspectorPanelProps {
  selectedTab: InspectorTabId;
  onSelectTab: (tab: InspectorTabId) => void;
  pendingApprovals: number;
  changedFiles: number;
  statusNotes: number;
  onOpenHelp: () => void;
  approvalsContent: ReactNode;
  filesContent: ReactNode;
  statusContent: ReactNode;
  settingsContent: ReactNode;
  promptContent: ReactNode;
}

function tabTitle(tab: InspectorTabId): string {
  if (tab === 'approvals') return 'Aprovações';
  if (tab === 'files') return 'Arquivos';
  if (tab === 'status') return 'Status';
  if (tab === 'settings') return 'Settings';
  return 'Prompt Base';
}

export function InspectorPanel({
  selectedTab,
  onSelectTab,
  pendingApprovals,
  changedFiles,
  statusNotes,
  onOpenHelp,
  approvalsContent,
  filesContent,
  statusContent,
  settingsContent,
  promptContent
}: InspectorPanelProps): JSX.Element {
  return (
    <section className="inspector-panel" data-testid="inspector-panel">
      <header className="inspector-header">
        <div>
          <h2>Inspector</h2>
          <p>{tabTitle(selectedTab)}</p>
        </div>
        <button type="button" className="btn-modern" onClick={onOpenHelp}>
          Ajuda
        </button>
      </header>

      <InspectorTabs
        selectedTab={selectedTab}
        onSelectTab={onSelectTab}
        pendingApprovals={pendingApprovals}
        changedFiles={changedFiles}
        statusNotes={statusNotes}
      />

      <div className="inspector-content" data-testid={`inspector-tab-${selectedTab}`}>
        {selectedTab === 'approvals' ? approvalsContent : null}
        {selectedTab === 'files' ? filesContent : null}
        {selectedTab === 'status' ? statusContent : null}
        {selectedTab === 'settings' ? settingsContent : null}
        {selectedTab === 'prompt' ? promptContent : null}
      </div>
    </section>
  );
}
