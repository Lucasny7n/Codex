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

    fireEvent.change(screen.getByPlaceholderText('Descreva objetivo, restrições, risco e validação esperada.'), {
      target: { value: 'rode uma tarefa' }
    });

    expect(screen.getByText('Provider indisponível')).toBeInTheDocument();
    expect(screen.getByText('Enviar ordem')).toBeDisabled();
  });
});
