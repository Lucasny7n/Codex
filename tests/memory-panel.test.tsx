import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryPanel } from '../src/components/panels/MemoryPanel';
import type { MemorySnapshot } from '../src/types/domain';

function memorySnapshot(): MemorySnapshot {
  return {
    profileSummary: 'Resumo operacional com contexto longo do usuario.',
    userPreferences: [
      'Preferencia 1',
      'Preferencia 2',
      'Preferencia 3',
      'Preferencia 4',
      'Preferencia 5',
      'Preferencia 6 com texto comprido que precisa quebrar linha sem sair do painel lateral.',
    ],
    activeProjects: ['Codex-Codex'],
    importantFixHistory: [],
    operationalPolicies: ['Diagnosticar antes de alterar.'],
  };
}

describe('MemoryPanel', () => {
  it('renderiza todas as mencoes em uma regiao rolavel', () => {
    const { container } = render(<MemoryPanel memory={memorySnapshot()} />);

    const preferences = screen.getByRole('list', { name: 'Preferências' });
    expect(within(preferences).getByText('Preferencia 1')).toBeInTheDocument();
    expect(
      within(preferences).getByText(
        'Preferencia 6 com texto comprido que precisa quebrar linha sem sair do painel lateral.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\+\d+ itens/)).not.toBeInTheDocument();
    expect(container.querySelector('.memory-layout.scroll-y')).toBeTruthy();
  });
});
