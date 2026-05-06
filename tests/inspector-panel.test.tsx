import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InspectorPanel } from '../src/components/panels/InspectorPanel';

function renderInspector(selectedTab: 'approvals' | 'files' | 'status' | 'settings' | 'prompt') {
  return render(
    <InspectorPanel
      selectedTab={selectedTab}
      onSelectTab={vi.fn()}
      pendingApprovals={1}
      changedFiles={2}
      statusNotes={3}
      onOpenHelp={vi.fn()}
      approvalsContent={<div>conteudo-aprovacoes</div>}
      filesContent={<div>conteudo-arquivos</div>}
      statusContent={<div>conteudo-status</div>}
      settingsContent={<div>conteudo-settings</div>}
      promptContent={<div>conteudo-prompt</div>}
    />,
  );
}

describe('InspectorPanel', () => {
  it('renderiza apenas uma aba por vez', () => {
    renderInspector('status');

    expect(screen.getByText('conteudo-status')).toBeInTheDocument();
    expect(screen.queryByText('conteudo-settings')).not.toBeInTheDocument();
    expect(screen.queryByText('conteudo-prompt')).not.toBeInTheDocument();
  });

  it('não mostra Settings e Prompt simultaneamente', () => {
    const onSelectTab = vi.fn();
    render(
      <InspectorPanel
        selectedTab="settings"
        onSelectTab={onSelectTab}
        pendingApprovals={0}
        changedFiles={0}
        statusNotes={0}
        onOpenHelp={vi.fn()}
        approvalsContent={<div>conteudo-aprovacoes</div>}
        filesContent={<div>conteudo-arquivos</div>}
        statusContent={<div>conteudo-status</div>}
        settingsContent={<div>conteudo-settings</div>}
        promptContent={<div>conteudo-prompt</div>}
      />,
    );

    expect(screen.getByText('conteudo-settings')).toBeInTheDocument();
    expect(screen.queryByText('conteudo-prompt')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Prompt' }));
    expect(onSelectTab).toHaveBeenCalledWith('prompt');
  });
});
