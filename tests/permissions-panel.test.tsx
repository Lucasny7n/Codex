import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PermissionsPanel } from '../src/components/panels/PermissionsPanel';
import type { PermissionOutcome, PermissionRequest } from '../src/types/domain';

function pendingRequest(): PermissionRequest {
  return {
    id: 'perm-1',
    title: 'Reiniciar serviço',
    description: 'Reinicia serviço allowlistado.',
    sessionId: 'session-1',
    command: 'systemctl restart waydroid-container.service',
    actionId: 'systemctl_restart_service',
    dryRun: true,
    cwd: '/home/lucas/Codex',
    category: 'privileged',
    risk: 'alto',
    riskLevel: 'high',
    requiresHighConfirmation: true,
    target: 'waydroid-container.service',
    rollback: 'systemctl restart waydroid-container.service',
    reason: 'teste',
    requestedAt: new Date().toISOString(),
    status: 'pending'
  };
}

function outcome(): PermissionOutcome {
  return {
    requestId: 'perm-1',
    sessionId: 'session-1',
    status: 'success',
    summary: 'Ação concluída',
    stdout: 'ok',
    stderr: undefined,
    exitCode: 0,
    at: new Date().toISOString()
  };
}

describe('PermissionsPanel', () => {
  it('renderiza permissão pendente com botões Sim/Não', () => {
    render(
      <PermissionsPanel
        requests={[pendingRequest()]}
        outcomes={[]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(screen.getByText('Reiniciar serviço')).toBeInTheDocument();
    expect(screen.getByText('Sim')).toBeInTheDocument();
    expect(screen.getByText('Não')).toBeInTheDocument();
  });

  it('renderiza resultado resumido da execução', () => {
    render(
      <PermissionsPanel
        requests={[]}
        outcomes={[outcome()]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(screen.getByText('Execuções Recentes')).toBeInTheDocument();
    expect(screen.getByText('Ação concluída')).toBeInTheDocument();
    expect(screen.getByText(/stdout:/)).toBeInTheDocument();
  });
});
