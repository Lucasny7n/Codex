import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatPanel } from '../src/components/chat/ChatPanel';
import type { AgentSession } from '../src/types/domain';

function chat(content: string, reasoningSummary?: string): AgentSession {
  const now = new Date().toISOString();
  return {
    id: 'session-1',
    title: 'Chat',
    createdAt: now,
    updatedAt: now,
    status: 'idle',
    messages: [
      {
        id: 'user-1',
        role: 'user',
        content: 'oi',
        createdAt: now,
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        content,
        createdAt: now,
        reasoningSummary,
      },
    ],
    tasks: [],
  };
}

describe('ChatPanel', () => {
  it('oculta metadata e detalhes técnicos no chat normal', () => {
    render(
      <ChatPanel
        session={chat('Resposta local concluída pela API HTTP\nTudo certo.', 'JUSTIFICATIVA TÉCNICA interna')}
      />,
    );

    expect(screen.queryByText('Você')).not.toBeInTheDocument();
    expect(screen.queryByText('Agente')).not.toBeInTheDocument();
    expect(screen.queryByText(/Resposta local concluída/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/JUSTIFICATIVA TÉCNICA/i)).not.toBeInTheDocument();
    expect(screen.getByText('Tudo certo.')).toBeInTheDocument();
    expect(screen.queryByText('Pensamento concluído')).not.toBeInTheDocument();
  });

  it('mostra indicador discreto enquanto aguarda resposta', () => {
    render(<ChatPanel session={chat('Resposta anterior')} isResponding />);

    expect(screen.getByLabelText('Assistente respondendo')).toBeInTheDocument();
  });

  it('renderiza markdown simples sem bolha técnica pesada', () => {
    render(<ChatPanel session={chat('### Resultado\n\n- Markdown limpo\n- Ações discretas\n\n`const status = "ok"`')} />);

    expect(screen.getByRole('heading', { name: 'Resultado' })).toBeInTheDocument();
    expect(screen.getByText('Markdown limpo')).toBeInTheDocument();
    expect(screen.getByText('const status = "ok"')).toBeInTheDocument();
  });

  it('renderiza headings, listas, inline code e bloco de código com segurança', () => {
    render(<ChatPanel session={chat('# Título\n\n## Seção\n\nTexto normal com `inline`.\n\n* item um\n- item dois\n\n```ts\nconst value = 1;\n```')} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Título' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Seção' })).toBeInTheDocument();
    expect(screen.getByText('inline')).toBeInTheDocument();
    expect(screen.getByText('item um')).toBeInTheDocument();
    expect(screen.getByText('item dois')).toBeInTheDocument();
    expect(screen.getByText('const value = 1;')).toBeInTheDocument();
  });

  it('não quebra com markdown malformado ou backticks incompletos', () => {
    render(<ChatPanel session={chat('Texto com `inline incompleto\n\n```ts\nconst ok = true;')} />);

    expect(screen.getByText(/Texto com `inline incompleto/)).toBeInTheDocument();
    expect(screen.getByText('const ok = true;')).toBeInTheDocument();
  });

  it('não renderiza chip de memória no chat — memória é contexto invisível', () => {
    const now = new Date().toISOString();
    const sessionWithMemory: AgentSession = {
      id: 'session-mem',
      title: 'Chat',
      createdAt: now,
      updatedAt: now,
      status: 'idle',
      tasks: [],
      messages: [
        {
          id: 'user-1',
          role: 'user',
          content: 'oi',
          createdAt: now,
          attachments: [
            {
              path: 'memory://global',
              name: 'Memórias ativas',
              kind: 'text',
              mimeType: 'text/plain',
              size: 0,
              previewAvailable: false,
              contextSource: 'memory',
              contextText: '[memórias do usuário]\n- gosta de café',
            },
            {
              path: '/tmp/arquivo.md',
              name: 'arquivo.md',
              kind: 'text',
              mimeType: 'text/plain',
              size: 42,
              previewAvailable: true,
              previewTextLimited: 'conteúdo do arquivo',
            },
          ],
        },
        { id: 'assistant-1', role: 'assistant', content: 'Tudo certo.', createdAt: now },
      ],
    };

    render(<ChatPanel session={sessionWithMemory} />);

    // Memory attachment must not appear as a chip
    expect(screen.queryByText('Memórias ativas')).not.toBeInTheDocument();
    // The user file chip SHOULD appear
    expect(screen.getByText('arquivo.md')).toBeInTheDocument();
  });

  it('não renderiza toggle de memória por conversa no header do chat', () => {
    render(<ChatPanel session={chat('Olá!')} />);

    expect(screen.queryByText(/memóri/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /memóri/i })).not.toBeInTheDocument();
  });

  it('project_memory e preset também não aparecem como chips', () => {
    const now = new Date().toISOString();
    const sessionWithSystemAttachments: AgentSession = {
      id: 'session-sys',
      title: 'Chat',
      createdAt: now,
      updatedAt: now,
      status: 'idle',
      tasks: [],
      messages: [
        {
          id: 'user-1',
          role: 'user',
          content: 'oi',
          createdAt: now,
          attachments: [
            { path: 'memory://project', name: 'Memória do projeto', kind: 'text', mimeType: 'text/plain', size: 0, previewAvailable: false, contextSource: 'project_memory' },
            { path: 'preset://default', name: 'Preset padrão', kind: 'text', mimeType: 'text/plain', size: 0, previewAvailable: false, contextSource: 'preset' },
            { path: 'tool://list_running_processes', name: 'Dados do sistema', kind: 'text', mimeType: 'text/plain', size: 0, previewAvailable: false, hidden: true, contextSource: 'system' },
          ],
        },
        { id: 'assistant-1', role: 'assistant', content: 'Tudo certo.', createdAt: now },
      ],
    };

    render(<ChatPanel session={sessionWithSystemAttachments} />);

    expect(screen.queryByText('Memória do projeto')).not.toBeInTheDocument();
    expect(screen.queryByText('Preset padrão')).not.toBeInTheDocument();
    expect(screen.queryByText('Dados do sistema')).not.toBeInTheDocument();
  });

  it('traduz 429 como cota sem JSON cru', () => {
    const onOpenEnvironment = vi.fn();

    render(
      <ChatPanel
        onOpenEnvironment={onOpenEnvironment}
        session={chat('Status: 429\nProvider: openai-api\n{"error":"insufficient_quota"}')}
      />,
    );

    expect(screen.getByText('Cota ou limite atingido')).toBeInTheDocument();
    expect(screen.getByText('Cota excedida nesta conta. Troque a conta, o provider ou aguarde o reset.')).toBeInTheDocument();
    expect(screen.queryByText(/insufficient_quota/)).not.toBeInTheDocument();
  });
});
