import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

function installStorage(): void {
  const values = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        values.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        values.delete(key);
      }),
      clear: vi.fn(() => values.clear()),
    },
  });
}

beforeEach(() => {
  installStorage();
  window.localStorage.clear();
});

describe('SessionsPanel', () => {
  it('exibe nova conversa sem persistir e expõe ações premium da sessão', () => {
    const onNewSession = vi.fn();
    const onSessionMenuAction = vi.fn();
    const onExport = vi.fn();
    const onDelete = vi.fn();
    const onDuplicate = vi.fn();
    const current = session();

    render(
      <SessionsPanel
        sessions={[current]}
        projects={['Ailu Projeto']}
        projectSessions={{}}
        activeProject={undefined}
        selectedSessionId={undefined}
        onNewSession={onNewSession}
        onNewProject={vi.fn()}
        onEditProject={vi.fn()}
        onDeleteProject={vi.fn()}
        onSelectProject={vi.fn()}
        onToggleSidebar={vi.fn()}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onDelete={onDelete}
        onExport={onExport}
        onDuplicate={onDuplicate}
        onSessionMenuAction={onSessionMenuAction}
        onOpenSettings={vi.fn()}
        onOpenArchivedConversations={vi.fn()}
        onCloseSession={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Nova Conversa'));
    expect(onNewSession).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Todas as conversas'));
    fireEvent.click(screen.getByLabelText('Ações da sessão Corrigir Settings'));
    expect(screen.getByLabelText('Ações da sessão Corrigir Settings')).toHaveClass('qwen-row-menu');
    fireEvent.click(screen.getByText('Pino'));
    expect(onSessionMenuAction).toHaveBeenCalledWith(current, 'pin');

    fireEvent.click(screen.getByLabelText('Ações da sessão Corrigir Settings'));
    fireEvent.click(screen.getByText('Clonar'));
    expect(onDuplicate).toHaveBeenCalledWith(current);

    fireEvent.click(screen.getByLabelText('Ações da sessão Corrigir Settings'));
    fireEvent.click(screen.getByText('Baixar'));
    expect(onExport).toHaveBeenCalledWith(current, 'markdown');

    fireEvent.click(screen.getByLabelText('Ações da sessão Corrigir Settings'));
    expect(screen.getByText('Excluir').closest('button')).toHaveClass('danger');
    fireEvent.click(screen.getByText('Excluir'));
    expect(onDelete).toHaveBeenCalledWith(current);
  });

  it('abre menu do usuário com itens esperados e fecha por Esc e click outside', async () => {
    render(
      <SessionsPanel
        sessions={[session()]}
        projects={['Ailu Projeto']}
        projectSessions={{}}
        activeProject={undefined}
        selectedSessionId={undefined}
        onNewSession={vi.fn()}
        onNewProject={vi.fn()}
        onEditProject={vi.fn()}
        onDeleteProject={vi.fn()}
        onSelectProject={vi.fn()}
        onToggleSidebar={vi.fn()}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onExport={vi.fn()}
        onDuplicate={vi.fn()}
        onSessionMenuAction={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenArchivedConversations={vi.fn()}
        onCloseSession={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Menu do usuário'));
    expect(screen.getByText('lucas545camargo@...')).toBeInTheDocument();
    expect(screen.getByText('Configurações')).toBeInTheDocument();
    expect(screen.getByText('Conversas arquivadas')).toBeInTheDocument();
    expect(screen.getByText('Sair')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByText('lucas545camargo@...')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Menu do usuário'));
    expect(screen.getByText('lucas545camargo@...')).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    await waitFor(() => {
      expect(screen.queryByText('lucas545camargo@...')).not.toBeInTheDocument();
    });
  });

  it('inicia projetos e conversas recolhidos e expande as seções independentemente', () => {
    const onRename = vi.fn();
    const onToggleSidebar = vi.fn();
    const current = session();

    render(
      <SessionsPanel
        sessions={[current]}
        projects={['Ailu Projeto']}
        projectSessions={{}}
        activeProject={undefined}
        selectedSessionId={current.id}
        onNewSession={vi.fn()}
        onNewProject={vi.fn()}
        onEditProject={vi.fn()}
        onDeleteProject={vi.fn()}
        onSelectProject={vi.fn()}
        onToggleSidebar={onToggleSidebar}
        onSelect={vi.fn()}
        onRename={onRename}
        onDelete={vi.fn()}
        onExport={vi.fn()}
        onDuplicate={vi.fn()}
        onSessionMenuAction={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenArchivedConversations={vi.fn()}
        onCloseSession={vi.fn()}
      />,
    );

    expect(screen.queryByText('Comunidade')).not.toBeInTheDocument();
    expect(screen.queryByText('Coder')).not.toBeInTheDocument();
    expect(screen.queryByText('Novo Projeto')).not.toBeInTheDocument();
    expect(screen.queryByText('Ailu Projeto')).not.toBeInTheDocument();
    expect(screen.queryByText('Corrigir Settings')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Recolher sidebar'));
    expect(onToggleSidebar).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Projetos'));
    expect(screen.getByText('Novo Projeto')).toBeInTheDocument();
    expect(screen.getByText('Ailu Projeto')).toBeInTheDocument();
    expect(screen.queryByText('Corrigir Settings')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Todas as conversas'));
    expect(screen.getByText('Novo Projeto')).toBeInTheDocument();
    expect(screen.getByText('Ailu Projeto')).toBeInTheDocument();
    expect(screen.getByText('Corrigir Settings')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Projetos'));
    expect(screen.queryByText('Novo Projeto')).not.toBeInTheDocument();
    expect(screen.queryByText('Ailu Projeto')).not.toBeInTheDocument();
    expect(screen.getByText('Corrigir Settings')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Ações da sessão Corrigir Settings'));
    fireEvent.click(screen.getByText('Renomear'));
    const input = screen.getByDisplayValue('Corrigir Settings');
    fireEvent.change(input, { target: { value: 'Sessão limpa' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRename).toHaveBeenCalledWith(current, 'Sessão limpa');
  });

  it('agrupa conversas por tempo: Hoje / Últimos 7 dias / Últimos 30 dias / Anteriores', () => {
    const day = 86_400_000;
    const at = (offsetDays: number) => new Date(Date.now() - offsetDays * day).toISOString();
    const make = (id: string, title: string, offsetDays: number): AgentSession => ({
      id,
      title,
      createdAt: at(offsetDays),
      updatedAt: at(offsetDays),
      status: 'idle',
      messages: [],
      tasks: [],
    });
    const sessions = [
      make('s-today', 'Conversa de hoje', 0),
      make('s-week', 'Conversa da semana', 3),
      make('s-month', 'Conversa do mês', 15),
      make('s-old', 'Conversa antiga', 120),
    ];

    render(
      <SessionsPanel
        sessions={sessions}
        projects={[]}
        projectSessions={{}}
        activeProject={undefined}
        selectedSessionId={undefined}
        onNewSession={vi.fn()}
        onNewProject={vi.fn()}
        onEditProject={vi.fn()}
        onDeleteProject={vi.fn()}
        onSelectProject={vi.fn()}
        onToggleSidebar={vi.fn()}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onExport={vi.fn()}
        onDuplicate={vi.fn()}
        onSessionMenuAction={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenArchivedConversations={vi.fn()}
        onCloseSession={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Todas as conversas'));
    expect(screen.getByText('Hoje')).toBeInTheDocument();
    expect(screen.getByText('Últimos 7 dias')).toBeInTheDocument();
    expect(screen.getByText('Últimos 30 dias')).toBeInTheDocument();
    expect(screen.getByText('Anteriores')).toBeInTheDocument();
  });

  it('mostra apenas ícones principais quando colapsada', () => {
    render(
      <SessionsPanel
        sessions={[session()]}
        projects={['Ailu Projeto']}
        projectSessions={{}}
        activeProject={undefined}
        selectedSessionId={undefined}
        onNewSession={vi.fn()}
        onNewProject={vi.fn()}
        onEditProject={vi.fn()}
        onDeleteProject={vi.fn()}
        onSelectProject={vi.fn()}
        onToggleSidebar={vi.fn()}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onExport={vi.fn()}
        onDuplicate={vi.fn()}
        onSessionMenuAction={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenArchivedConversations={vi.fn()}
        onCloseSession={vi.fn()}
        collapsed
      />,
    );

    expect(screen.getByLabelText('Abrir sidebar')).toBeInTheDocument();
    expect(screen.getByLabelText('Conversas')).toHaveClass('qwen-sidebar-collapsed');
    expect(screen.queryByLabelText('Início')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Nova Conversa')).toBeInTheDocument();
    expect(screen.getByLabelText('Pesquisar Conversas')).toBeInTheDocument();
    expect(screen.getByLabelText('Menu do usuário')).toBeInTheDocument();
    expect(screen.queryByText('Projetos')).not.toBeInTheDocument();
    expect(screen.queryByText('Todas as conversas')).not.toBeInTheDocument();
    expect(screen.queryByText('Ailu Projeto')).not.toBeInTheDocument();
    expect(screen.queryByText('Corrigir Settings')).not.toBeInTheDocument();
  });
});
