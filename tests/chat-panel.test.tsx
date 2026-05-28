import { fireEvent, render, screen } from '@testing-library/react';
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

  it('erro 429 vira card acionável com provider/modelo na superfície', () => {
    render(
      <ChatPanel
        onChangeModel={vi.fn()}
        onChangeAccount={vi.fn()}
        session={chat('Status: 429\nProvider: openai-api\nModelo: gpt-5.5\n{"error":"insufficient_quota"}')}
      />,
    );

    expect(screen.getByText('Limite ou crédito insuficiente')).toBeInTheDocument();
    // Provider + modelo aparecem na superfície.
    expect(screen.getByText(/gpt-5\.5 via openai-api/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trocar modelo' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Trocar conta' })).toBeEnabled();
  });

  it('erro 401 indica chave inválida', () => {
    render(<ChatPanel session={chat('Status: 401\nProvider: openrouter\nunauthorized')} />);
    expect(screen.getByText('API key inválida')).toBeInTheDocument();
  });

  it('erro 404 indica modelo indisponível', () => {
    render(<ChatPanel session={chat('Status: 404\nProvider: openrouter\nModelo: claude-x\nmodel not found')} />);
    expect(screen.getByText('Modelo indisponível')).toBeInTheDocument();
  });

  it('erro genérico de provider ainda vira card', () => {
    render(<ChatPanel session={chat('Provider: groq falhou\napi key ausente')} />);
    expect(screen.getByText(/Detalhes técnicos/)).toBeInTheDocument();
  });

  it('nunca vaza segredo: API key/Bearer são mascarados nos detalhes', () => {
    render(
      <ChatPanel
        session={chat('Status: 401\nProvider: openai-api\nAuthorization: Bearer sk-live-ABCDEF123456 falhou')}
      />,
    );
    // Abre os detalhes técnicos.
    fireEvent.click(screen.getByText('Detalhes técnicos'));
    expect(screen.queryByText(/sk-live-ABCDEF123456/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/sk-live-ABCDEF123456/);
  });

  it('mostra aviso discreto de fallback quando o backend usou fallback', () => {
    render(
      <ChatPanel
        session={chat(
          'Resposta do modelo de fallback.',
          'Respondido por fallback: openrouter/claude-3.5. Tentativas: openai/gpt-5 -> openrouter/claude-3.5.',
        )}
      />,
    );
    expect(screen.getByText(/Modelo principal falhou; respondido com fallback/)).toBeInTheDocument();
    expect(screen.getByText(/openrouter\/claude-3\.5/)).toBeInTheDocument();
  });
});
