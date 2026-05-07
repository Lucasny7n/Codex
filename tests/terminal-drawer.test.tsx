import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TerminalDrawer } from '../src/components/panels/TerminalDrawer';
import type { CommandLogChunk } from '../src/types/domain';

function logs(): CommandLogChunk[] {
  return [
    {
      executionId: 'exec-1',
      sessionId: 'session-1',
      stream: 'stdout',
      line: 'linha de teste',
      at: new Date().toISOString()
    }
  ];
}

describe('TerminalDrawer', () => {
  it('pode ser expandido e colapsado', () => {
    const { rerender } = render(<TerminalDrawer logs={logs()} open={false} onToggle={vi.fn()} />);

    expect(screen.queryByText('linha de teste')).not.toBeInTheDocument();

    const onToggle = vi.fn();
    rerender(<TerminalDrawer logs={logs()} open={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: /Terminal e logs/i }));
    expect(onToggle).toHaveBeenCalled();

    rerender(<TerminalDrawer logs={logs()} open onToggle={vi.fn()} />);
    expect(screen.getByText('linha de teste')).toBeInTheDocument();

    rerender(<TerminalDrawer logs={logs()} open={false} onToggle={vi.fn()} />);
    expect(screen.queryByText('linha de teste')).not.toBeInTheDocument();
  });
});
