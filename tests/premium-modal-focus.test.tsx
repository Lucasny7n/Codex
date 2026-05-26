import { fireEvent, render, screen } from '@testing-library/react';
import { act, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { PremiumModal } from '../src/components/common/PremiumUI';

function ModalWithInput({ onClose }: { onClose: () => void }): JSX.Element {
  const [value, setValue] = useState('');
  return (
    <PremiumModal open title="Teste" onClose={onClose}>
      <input
        data-testid="project-name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Nome do projeto"
      />
    </PremiumModal>
  );
}

describe('PremiumModal focus stability', () => {
  it('input controlado mantém valor após várias mudanças (sem remount)', () => {
    render(<ModalWithInput onClose={() => { /* noop */ }} />);

    const input = screen.getByTestId('project-name') as HTMLInputElement;
    input.focus();

    // Simula digitação caractere a caractere — cada change re-renderiza o pai
    // e antes do fix isso faria o useEffect re-focar o primeiro elemento,
    // perdendo o foco do input.
    const text = 'Meu Projeto Legal';
    for (const char of text) {
      act(() => {
        fireEvent.change(input, { target: { value: input.value + char } });
      });
    }

    expect(input).toHaveValue(text);
  });

  it('onClose instável não reinicia o foco do modal', () => {
    // Wraps the modal so onClose is a new function reference on every render,
    // which was the root cause of the bug.
    function Wrapper(): JSX.Element {
      const [count, setCount] = useState(0);
      return (
        <>
          <ModalWithInput onClose={() => setCount((n) => n + 1)} />
          <span data-testid="count">{count}</span>
        </>
      );
    }

    render(<Wrapper />);
    const input = screen.getByTestId('project-name') as HTMLInputElement;
    input.focus();

    act(() => {
      fireEvent.change(input, { target: { value: 'A' } });
    });
    act(() => {
      fireEvent.change(input, { target: { value: 'AB' } });
    });
    act(() => {
      fireEvent.change(input, { target: { value: 'ABC' } });
    });

    // Despite 3 re-renders with a new onClose ref each time, input retains value
    expect(input).toHaveValue('ABC');
  });
});
