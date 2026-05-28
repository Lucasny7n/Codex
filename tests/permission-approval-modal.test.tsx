import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PermissionApprovalModal } from '../src/components/panels/PermissionApprovalModal';
import type { PermissionRequest } from '../src/types/domain';

function request(overrides: Partial<PermissionRequest> = {}): PermissionRequest {
  return {
    id: 'perm-1',
    title: 'Atualizar o sistema',
    description: 'Atualização completa de pacotes',
    sessionId: 'session-1',
    command: 'sudo pacman -Syu',
    dryRun: false,
    cwd: '/home/user',
    category: 'system' as PermissionRequest['category'],
    risk: 'alto',
    riskLevel: 'high',
    requiresHighConfirmation: true,
    target: '/var/cache/pacman',
    rollback: 'pacman -U <cache>',
    reason: 'O usuário pediu para atualizar o sistema.',
    requestedAt: new Date().toISOString(),
    status: 'pending',
    ...overrides,
  };
}

describe('PermissionApprovalModal', () => {
  it('mostra comando, risco, motivo, alvo e rollback, e nunca executa sozinho', () => {
    const onDecide = vi.fn().mockResolvedValue(undefined);
    render(<PermissionApprovalModal permissions={[request()]} onDecide={onDecide} />);

    expect(screen.getByText('Aprovação necessária')).toBeInTheDocument();
    expect(screen.getByText('sudo pacman -Syu')).toBeInTheDocument();
    expect(screen.getByText('Alto risco')).toBeInTheDocument();
    expect(screen.getByText('O usuário pediu para atualizar o sistema.')).toBeInTheDocument();
    expect(screen.getByText('/var/cache/pacman')).toBeInTheDocument();
    expect(screen.getByText(/sempre pede aprovação/i)).toBeInTheDocument();
    // No decision happens without an explicit click.
    expect(onDecide).not.toHaveBeenCalled();
  });

  it('aprova somente com clique explícito', async () => {
    const onDecide = vi.fn().mockResolvedValue(undefined);
    render(<PermissionApprovalModal permissions={[request()]} onDecide={onDecide} />);

    fireEvent.click(screen.getByText('Aprovar e executar'));
    await waitFor(() => expect(onDecide).toHaveBeenCalledWith('perm-1', 'allow_once'));
  });

  it('nega ao clicar em Negar', async () => {
    const onDecide = vi.fn().mockResolvedValue(undefined);
    render(<PermissionApprovalModal permissions={[request()]} onDecide={onDecide} />);

    fireEvent.click(screen.getByText('Negar'));
    await waitFor(() => expect(onDecide).toHaveBeenCalledWith('perm-1', 'deny_once'));
  });

  it('copia o comando para a área de transferência', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<PermissionApprovalModal permissions={[request()]} onDecide={vi.fn()} />);

    fireEvent.click(screen.getByText('Copiar comando'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('sudo pacman -Syu'));
  });

  it('não renderiza nada quando não há solicitações pendentes', () => {
    const { container } = render(
      <PermissionApprovalModal permissions={[request({ status: 'allowed' as PermissionRequest['status'] })]} onDecide={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
