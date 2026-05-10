import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatPanel } from '../src/components/panels/ChatPanel';
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
