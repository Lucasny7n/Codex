import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from '../src/lib/api';
import { MemoryManagerModal } from '../src/components/panels/MemoryManagerModal';
import type { MemoryEntry } from '../src/types/domain';

vi.mock('../src/lib/api', () => ({
  listMemoryEntries: vi.fn(),
  saveMemoryEntry: vi.fn(),
  deleteMemoryEntry: vi.fn(),
}));

function entries(): MemoryEntry[] {
  return [
    {
      id: 'g1',
      content: 'Prefere respostas curtas',
      kind: 'preference',
      scope: 'global',
      origin: 'user',
      confidence: 1,
      manual: true,
      createdAt: '2026-05-01T00:00:00Z',
    },
    {
      id: 'p1',
      content: 'Projeto usa Tauri',
      kind: 'fact',
      scope: 'project',
      project: 'ailu',
      origin: 'inferred',
      confidence: 0.8,
      manual: false,
      createdAt: '2026-05-02T00:00:00Z',
    },
  ];
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('MemoryManagerModal', () => {
  it('lists entries and filters by scope', async () => {
    vi.mocked(api.listMemoryEntries).mockResolvedValue(entries());
    render(<MemoryManagerModal open onClose={vi.fn()} onToast={vi.fn()} />);

    expect(await screen.findByText('Prefere respostas curtas')).toBeInTheDocument();
    expect(screen.getByText('Projeto usa Tauri')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Global' }));
    expect(screen.getByText('Prefere respostas curtas')).toBeInTheDocument();
    expect(screen.queryByText('Projeto usa Tauri')).not.toBeInTheDocument();
  });

  it('shows origin and confidence for inferred memories', async () => {
    vi.mocked(api.listMemoryEntries).mockResolvedValue(entries());
    render(<MemoryManagerModal open onClose={vi.fn()} onToast={vi.fn()} />);
    await screen.findByText('Projeto usa Tauri');
    expect(screen.getByText('Origem: Inferida')).toBeInTheDocument();
    expect(screen.getByText('Confiança: 80%')).toBeInTheDocument();
  });

  it('creates a new memory through the editor', async () => {
    vi.mocked(api.listMemoryEntries).mockResolvedValue([]);
    vi.mocked(api.saveMemoryEntry).mockResolvedValue(entries());
    const onToast = vi.fn();
    render(<MemoryManagerModal open onClose={vi.fn()} onToast={onToast} />);

    await waitFor(() => expect(api.listMemoryEntries).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Nova memória' }));
    fireEvent.change(screen.getByPlaceholderText('O que o Ailu deve lembrar?'), {
      target: { value: 'Nova preferência' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(api.saveMemoryEntry).toHaveBeenCalled());
    const saved = vi.mocked(api.saveMemoryEntry).mock.calls[0][0];
    expect(saved.content).toBe('Nova preferência');
    expect(saved.scope).toBe('global');
    expect(saved.manual).toBe(true);
    expect(saved.id).toBeTruthy();
    expect(onToast).toHaveBeenCalledWith('success', expect.any(String));
  });

  it('refuses to save empty content', async () => {
    vi.mocked(api.listMemoryEntries).mockResolvedValue([]);
    render(<MemoryManagerModal open onClose={vi.fn()} onToast={vi.fn()} />);
    await waitFor(() => expect(api.listMemoryEntries).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Nova memória' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('conteúdo');
    expect(api.saveMemoryEntry).not.toHaveBeenCalled();
  });

  it('deletes a memory', async () => {
    vi.mocked(api.listMemoryEntries).mockResolvedValue(entries());
    vi.mocked(api.deleteMemoryEntry).mockResolvedValue([entries()[0]]);
    render(<MemoryManagerModal open onClose={vi.fn()} onToast={vi.fn()} />);

    const item = (await screen.findByText('Projeto usa Tauri')).closest('li') as HTMLElement;
    fireEvent.click(within(item).getByRole('button', { name: 'Apagar' }));
    await waitFor(() => expect(api.deleteMemoryEntry).toHaveBeenCalledWith('p1'));
  });
});
