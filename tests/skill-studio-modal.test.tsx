import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillStudioModal } from '../src/components/panels/SkillStudioModal';
import * as api from '../src/lib/api';

vi.mock('../src/lib/api', () => ({
  listSkills: vi.fn(),
  planSkill: vi.fn(),
  markSkillTrusted: vi.fn(),
  testSkillInVm: vi.fn(),
  requestExecution: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.mocked(api.listSkills).mockResolvedValue([]);
});

describe('SkillStudioModal', () => {
  it('empty state oferece CTAs Importar / Criar por texto / Criar com IA', async () => {
    render(<SkillStudioModal open sessionId="s1" onClose={vi.fn()} onToast={vi.fn()} />);
    await waitFor(() => expect(api.listSkills).toHaveBeenCalled());
    expect(screen.getByText('Nenhuma skill ainda')).toBeInTheDocument();
    expect(screen.getByText(/dry-run e aprovação antes de rodar/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Importar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar por texto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar com IA' })).toBeInTheDocument();
  });

  it('importa: valida manifest JSON e exige dry-run em scripts', async () => {
    render(<SkillStudioModal open sessionId="s1" onClose={vi.fn()} onToast={vi.fn()} />);
    await waitFor(() => expect(api.listSkills).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('tab', { name: 'Importar' }));
    const textarea = screen.getByPlaceholderText(/Cole aqui o conteúdo da skill/);

    fireEvent.change(textarea, { target: { value: '{"name":"Minha Skill","riskLevel":"low"}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Analisar' }));
    expect(screen.getByText(/Manifest JSON reconhecido/)).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: '#!/usr/bin/env bash\nrm -rf /tmp/x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Analisar' }));
    expect(screen.getByText(/Sem dry-run no script/i)).toBeInTheDocument();
  });

  it('importa e salva a skill localmente, aparecendo em Minhas Skills', async () => {
    const onToast = vi.fn();
    render(<SkillStudioModal open sessionId="s1" onClose={vi.fn()} onToast={onToast} />);
    await waitFor(() => expect(api.listSkills).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('tab', { name: 'Importar' }));
    fireEvent.change(screen.getByPlaceholderText(/Cole aqui o conteúdo da skill/), {
      target: { value: '{"name":"Skill Importada","description":"faz algo","riskLevel":"low"}' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analisar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar skill importada' }));

    expect(onToast).toHaveBeenCalledWith('success', expect.stringContaining('importada'));
    // Volta para Minhas Skills com a skill local listada.
    expect(screen.getByText('Skill Importada')).toBeInTheDocument();
    expect(screen.getByText(/Skills locais/)).toBeInTheDocument();
  });

  it('cria skill por texto, persiste e o dry-run é simulado sem executar', async () => {
    const onToast = vi.fn();
    render(<SkillStudioModal open sessionId="s1" onClose={vi.fn()} onToast={onToast} />);
    await waitFor(() => expect(api.listSkills).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('tab', { name: 'Criar por texto' }));
    fireEvent.change(screen.getByPlaceholderText('Reiniciar rede'), { target: { value: 'Minha Skill Manual' } });
    fireEvent.change(screen.getByPlaceholderText(/Inclua um modo --dry-run/), {
      target: { value: '#!/usr/bin/env bash\necho "oi"' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar skill' }));

    expect(onToast).toHaveBeenCalledWith('success', expect.stringContaining('criada'));
    expect(screen.getByText('Minha Skill Manual')).toBeInTheDocument();

    // Testar (dry-run) mostra preview simulado e NÃO executa nada.
    fireEvent.click(screen.getByRole('button', { name: 'Testar (dry-run)' }));
    expect(screen.getByText(/Dry-run simulado/)).toBeInTheDocument();
    expect(screen.getByText(/Nada é executado/)).toBeInTheDocument();
    expect(api.requestExecution).not.toHaveBeenCalled();
  });

  it('skill local criada persiste após reabrir o modal', async () => {
    const { rerender } = render(<SkillStudioModal open sessionId="s1" onClose={vi.fn()} onToast={vi.fn()} />);
    await waitFor(() => expect(api.listSkills).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('tab', { name: 'Criar por texto' }));
    fireEvent.change(screen.getByPlaceholderText('Reiniciar rede'), { target: { value: 'Persistente' } });
    fireEvent.change(screen.getByPlaceholderText(/Inclua um modo --dry-run/), { target: { value: 'echo persiste' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar skill' }));
    expect(screen.getByText('Persistente')).toBeInTheDocument();

    // Fecha e reabre — deve recarregar do store local.
    rerender(<SkillStudioModal open={false} sessionId="s1" onClose={vi.fn()} onToast={vi.fn()} />);
    rerender(<SkillStudioModal open sessionId="s1" onClose={vi.fn()} onToast={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Persistente')).toBeInTheDocument());
  });
});
