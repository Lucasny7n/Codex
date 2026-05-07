import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommandInputPanel } from '../src/components/panels/CommandInputPanel';

describe('CommandInputPanel', () => {
  it('bloqueia envio de ordem quando provider está indisponível', () => {
    render(
      <CommandInputPanel
        busy={false}
        privilegedActions={[]}
        actionJsonExamples={{}}
        onSendOrder={vi.fn()}
        onExecuteCommand={vi.fn()}
        onRequestPrivilegedAction={vi.fn()}
        orderDisabledReason="Provider indisponível"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Como posso ajudá-lo hoje?'), {
      target: { value: 'rode uma tarefa' }
    });

    expect(screen.queryByText('Provider indisponível')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Enviar')).toBeDisabled();
    expect(screen.getByLabelText('Enviar')).toHaveAttribute('title', 'Provider indisponível');
  });

  it('mantem terminal fora da home ate ação explicita', () => {
    const onOpenTerminal = vi.fn();

    render(
      <CommandInputPanel
        busy={false}
        privilegedActions={[]}
        actionJsonExamples={{}}
        onSendOrder={vi.fn()}
        onExecuteCommand={vi.fn()}
        onRequestPrivilegedAction={vi.fn()}
        onOpenTerminal={onOpenTerminal}
      />,
    );

    fireEvent.click(screen.getByLabelText('Mais ações'));
    expect(screen.getByText('Usar terminal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Usar terminal'));
    expect(onOpenTerminal).toHaveBeenCalledTimes(1);
    expect(screen.getByPlaceholderText('Comando de terminal')).toBeInTheDocument();
  });
});
