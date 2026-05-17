import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiWorkspacePanel, type WorkspacePlanItem } from '../src/components/workspace/AiWorkspacePanel';
import type { ProviderDescriptor } from '../src/types/domain';

const readyProvider: ProviderDescriptor = {
  id: 'mock-provider',
  label: 'Mock Provider',
  configurable: true,
  enabled: true,
  status: {
    state: 'ready',
    message: 'Provider pronto para teste.',
    checkedAt: '2026-05-17T00:00:00.000Z',
  },
  models: [],
};

function renderWorkspace(planItems: WorkspacePlanItem[] = []): {
  onPlanChange: ReturnType<typeof vi.fn>;
  onOpenProviderSettings: ReturnType<typeof vi.fn>;
} {
  const onPlanChange = vi.fn();
  const onOpenProviderSettings = vi.fn();

  render(
    <AiWorkspacePanel
      workspaceRoot="/tmp/workspace"
      providers={[readyProvider]}
      pendingPermissions={[]}
      changedFiles={[]}
      statusFeed={[]}
      planItems={planItems}
      terminalEnabled
      webPreviewEnabled={false}
      onOpenTerminal={vi.fn()}
      onOpenProviderSettings={onOpenProviderSettings}
      onPlanChange={onPlanChange}
      onExportPlan={vi.fn()}
    />,
  );

  return { onPlanChange, onOpenProviderSettings };
}

describe('AI Workspace panel', () => {
  it('edits an existing plan item instead of forcing recreate', () => {
    const item: WorkspacePlanItem = {
      id: 'task-1',
      title: 'Auditar biblioteca',
      detail: 'Revisar filtros',
      status: 'todo',
    };
    const { onPlanChange } = renderWorkspace([item]);

    fireEvent.click(screen.getByLabelText('Editar Auditar biblioteca'));
    fireEvent.change(screen.getByLabelText('Editar título de Auditar biblioteca'), {
      target: { value: 'Auditar biblioteca LLM' },
    });
    fireEvent.change(screen.getByLabelText('Editar detalhe de Auditar biblioteca'), {
      target: { value: 'Revisar filtros e tags' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onPlanChange).toHaveBeenCalledWith([
      {
        ...item,
        title: 'Auditar biblioteca LLM',
        detail: 'Revisar filtros e tags',
      },
    ]);
  });

  it('requires an inline confirmation before clearing the plan', () => {
    const item: WorkspacePlanItem = { id: 'task-1', title: 'Testar app', status: 'doing' };
    const { onPlanChange } = renderWorkspace([item]);

    fireEvent.click(screen.getByRole('button', { name: 'Clear plan' }));
    expect(onPlanChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm clear' }));
    expect(onPlanChange).toHaveBeenCalledWith([]);
  });

  it('stages and removes local file context without claiming backend ingestion', () => {
    renderWorkspace();

    fireEvent.change(screen.getByLabelText('Adicionar contexto local'), {
      target: { value: 'docs/upgrade-v2-audit.md' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Stage' }));

    expect(screen.getByText('docs/upgrade-v2-audit.md')).toBeVisible();
    fireEvent.click(screen.getByLabelText('Remover contexto docs/upgrade-v2-audit.md'));
    expect(screen.queryByText('docs/upgrade-v2-audit.md')).toBeNull();
  });

  it('routes provider settings from the workspace surface', () => {
    const { onOpenProviderSettings } = renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Settings & models' }));
    expect(onOpenProviderSettings).toHaveBeenCalledTimes(1);
  });
});
