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
  vi.mocked(api.listSkills).mockResolvedValue([]);
});

describe('SkillStudioModal', () => {
  it('mostra empty state com CTA para Importar/Criar quando não há skills', async () => {
    render(<SkillStudioModal open sessionId="s1" onClose={vi.fn()} onToast={vi.fn()} />);
    await waitFor(() => expect(api.listSkills).toHaveBeenCalled());
    expect(screen.getByText('Nenhuma skill ainda')).toBeInTheDocument();
    expect(screen.getByText(/dry-run e aprovação antes de rodar/)).toBeInTheDocument();
  });

  it('importa: valida manifest JSON e exige dry-run em scripts', async () => {
    render(<SkillStudioModal open sessionId="s1" onClose={vi.fn()} onToast={vi.fn()} />);
    await waitFor(() => expect(api.listSkills).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Importar' }));
    const textarea = screen.getByPlaceholderText(/Cole aqui o conteúdo da skill/);

    // JSON manifest → análise reconhece campos.
    fireEvent.change(textarea, { target: { value: '{"id":"x","name":"Minha Skill","riskLevel":"low"}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Analisar' }));
    expect(screen.getByText(/manifest JSON válido/)).toBeInTheDocument();

    // Script sem dry-run → aviso de obrigatoriedade.
    fireEvent.change(textarea, { target: { value: '#!/usr/bin/env bash\nrm -rf /tmp/x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Analisar' }));
    expect(screen.getByText(/nenhum dry-run detectado/i)).toBeInTheDocument();
  });

  it('criar por texto não executa nada — exige provider', async () => {
    const onToast = vi.fn();
    render(<SkillStudioModal open sessionId="s1" onClose={vi.fn()} onToast={onToast} />);
    await waitFor(() => expect(api.listSkills).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Criar por texto' }));
    fireEvent.change(screen.getByPlaceholderText(/Reiniciar o serviço de rede/), {
      target: { value: 'reiniciar rede com dry-run' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar skill com IA' }));

    expect(onToast).toHaveBeenCalledWith('info', expect.stringContaining('provider configurado'));
    // Nada foi executado.
    expect(api.requestExecution).not.toHaveBeenCalled();
  });
});
