import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SessionsPanel } from '../src/components/panels/SessionsPanel';
import type { AgentSession } from '../src/types/domain';

function session(): AgentSession {
  const now = new Date().toISOString();
  return {
    id: 'session-1',
    title: 'Corrigir Settings',
    createdAt: now,
    updatedAt: now,
    status: 'idle',
    messages: [
      {
        id: 'message-1',
        role: 'user',
        content: 'corrigir settings',
        createdAt: now,
      },
    ],
    tasks: [],
    providerId: 'openai-api',
    modelId: 'gpt-5.5',
  };
}

describe('SessionsPanel', () => {
  it('exibe nova conversa sem persistir e expõe ações reais da sessão', () => {
    const onNewSession = vi.fn();
    const onInfo = vi.fn();
    const onExport = vi.fn();
    const onDelete = vi.fn();
    const current = session();

    render(
      <SessionsPanel
        sessions={[current]}
        selectedSessionId={undefined}
        onNewSession={onNewSession}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onDelete={onDelete}
        onExport={onExport}
        onDuplicate={vi.fn()}
        onInfo={onInfo}
      />,
    );

    fireEvent.click(screen.getByText('Nova conversa'));
    expect(onNewSession).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Info'));
    expect(onInfo).toHaveBeenCalledWith(current);

    fireEvent.click(screen.getByText('.md'));
    expect(onExport).toHaveBeenCalledWith(current, 'markdown');

    fireEvent.click(screen.getByText('Excluir'));
    expect(onDelete).toHaveBeenCalledWith(current);
  });
});
