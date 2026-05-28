import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillStudioModal } from '../src/components/panels/SkillStudioModal';
import * as api from '../src/lib/api';
import type { UserSkill, UserSkillInput } from '../src/types/domain';

vi.mock('../src/lib/api', () => ({
  listSkills: vi.fn(),
  planSkill: vi.fn(),
  markSkillTrusted: vi.fn(),
  testSkillInVm: vi.fn(),
  requestExecution: vi.fn(),
  listUserSkills: vi.fn(),
  saveUserSkill: vi.fn(),
  deleteUserSkill: vi.fn(),
  dryRunUserSkill: vi.fn(),
}));

// Stateful in-memory backend stand-in, mirroring the Rust store behavior.
let store: UserSkill[] = [];

function inferRisk(input: UserSkillInput): UserSkill['risk'] {
  if (/rm\s+-rf|mkfs|dd\s+if=/u.test(input.content ?? '')) return 'high';
  return input.risk ?? 'low';
}

beforeEach(() => {
  vi.clearAllMocks();
  store = [];
  vi.mocked(api.listSkills).mockResolvedValue([]);
  vi.mocked(api.listUserSkills).mockImplementation(async () => store);
  vi.mocked(api.saveUserSkill).mockImplementation(async (input: UserSkillInput) => {
    store = [
      {
        id: `local-${store.length}-${input.name}`,
        name: input.name,
        description: input.description ?? '',
        content: input.content ?? '',
        source: input.source ?? 'manual',
        permissions: input.permissions ?? [],
        risk: inferRisk(input),
        createdAt: 'now',
        updatedAt: 'now',
      },
      ...store,
    ];
    return store;
  });
  vi.mocked(api.deleteUserSkill).mockImplementation(async (id: string) => {
    store = store.filter((s) => s.id !== id);
    return store;
  });
  vi.mocked(api.dryRunUserSkill).mockImplementation(async (id: string) => {
    const skill = store.find((s) => s.id === id)!;
    const dangerous = /rm\s+-rf|mkfs|dd\s+if=/u.test(skill.content) ? ['rm -rf'] : [];
    return {
      skillId: id,
      summary: `Simulação de "${skill.name}". Nada é executado aqui.`,
      permissions: skill.permissions,
      risk: skill.risk,
      requiresApproval: skill.risk !== 'low' || dangerous.length > 0,
      dangerousTokens: dangerous,
      preview: `# Dry-run simulado\n${skill.content}`,
    };
  });
});

describe('SkillStudioModal', () => {
  it('empty state oferece CTAs Importar / Criar por texto / Criar com IA', async () => {
    render(<SkillStudioModal open sessionId="s1" onClose={vi.fn()} onToast={vi.fn()} />);
    await waitFor(() => expect(api.listUserSkills).toHaveBeenCalled());
    expect(screen.getByText('Nenhuma skill ainda')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Importar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar por texto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar com IA' })).toBeInTheDocument();
  });

  it('importa: valida manifest JSON e exige dry-run em scripts', async () => {
    render(<SkillStudioModal open sessionId="s1" onClose={vi.fn()} onToast={vi.fn()} />);
    await waitFor(() => expect(api.listUserSkills).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('tab', { name: 'Importar' }));
    const textarea = screen.getByPlaceholderText(/Cole aqui o conteúdo da skill/);

    fireEvent.change(textarea, { target: { value: '{"name":"Minha Skill","riskLevel":"low"}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Analisar' }));
    expect(screen.getByText(/Manifest JSON reconhecido/)).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: '#!/usr/bin/env bash\nrm -rf /tmp/x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Analisar' }));
    expect(screen.getByText(/Sem dry-run no script/i)).toBeInTheDocument();
  });

  it('importa JSON válido e persiste no backend', async () => {
    const onToast = vi.fn();
    render(<SkillStudioModal open sessionId="s1" onClose={vi.fn()} onToast={onToast} />);
    await waitFor(() => expect(api.listUserSkills).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('tab', { name: 'Importar' }));
    fireEvent.change(screen.getByPlaceholderText(/Cole aqui o conteúdo da skill/), {
      target: { value: '{"name":"Skill Importada","description":"faz algo","riskLevel":"low"}' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analisar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar skill importada' }));

    await waitFor(() => expect(api.saveUserSkill).toHaveBeenCalled());
    expect(onToast).toHaveBeenCalledWith('success', expect.stringContaining('importada'));
    expect(await screen.findByText('Skill Importada')).toBeInTheDocument();
  });

  it('cria skill por texto, persiste e dry-run é simulado sem executar', async () => {
    const onToast = vi.fn();
    render(<SkillStudioModal open sessionId="s1" onClose={vi.fn()} onToast={onToast} />);
    await waitFor(() => expect(api.listUserSkills).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('tab', { name: 'Criar por texto' }));
    fireEvent.change(screen.getByPlaceholderText('Reiniciar rede'), { target: { value: 'Minha Skill Manual' } });
    fireEvent.change(screen.getByPlaceholderText(/Inclua um modo --dry-run/), {
      target: { value: '#!/usr/bin/env bash\necho "oi"' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar skill' }));

    await waitFor(() => expect(api.saveUserSkill).toHaveBeenCalled());
    expect(onToast).toHaveBeenCalledWith('success', expect.stringContaining('criada'));
    expect(await screen.findByText('Minha Skill Manual')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Testar (dry-run)' }));
    await waitFor(() => expect(api.dryRunUserSkill).toHaveBeenCalled());
    expect(screen.getByText(/Nada é executado/)).toBeInTheDocument();
    // Dry-run NUNCA executa.
    expect(api.requestExecution).not.toHaveBeenCalled();
  });

  it('skill de alto risco (rm -rf) exige aprovação no dry-run', async () => {
    render(<SkillStudioModal open sessionId="s1" onClose={vi.fn()} onToast={vi.fn()} />);
    await waitFor(() => expect(api.listUserSkills).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('tab', { name: 'Criar por texto' }));
    fireEvent.change(screen.getByPlaceholderText('Reiniciar rede'), { target: { value: 'Perigosa' } });
    fireEvent.change(screen.getByPlaceholderText(/Inclua um modo --dry-run/), {
      target: { value: 'rm -rf /tmp/x' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar skill' }));
    await screen.findByText('Perigosa');

    fireEvent.click(screen.getByRole('button', { name: 'Testar (dry-run)' }));
    expect(await screen.findByText(/exige aprovação explícita/)).toBeInTheDocument();
    expect(api.requestExecution).not.toHaveBeenCalled();
  });

  it('remove skill local pelo backend', async () => {
    const onToast = vi.fn();
    render(<SkillStudioModal open sessionId="s1" onClose={vi.fn()} onToast={onToast} />);
    await waitFor(() => expect(api.listUserSkills).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('tab', { name: 'Criar por texto' }));
    fireEvent.change(screen.getByPlaceholderText('Reiniciar rede'), { target: { value: 'Removível' } });
    fireEvent.change(screen.getByPlaceholderText(/Inclua um modo --dry-run/), { target: { value: 'echo x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar skill' }));
    await screen.findByText('Removível');

    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    await waitFor(() => expect(api.deleteUserSkill).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Removível')).not.toBeInTheDocument());
  });
});
