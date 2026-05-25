import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SkillsPanel } from '../src/components/panels/SkillsPanel';
import type { SkillExecutionPlan, SkillManifest, SkillVmReport } from '../src/types/domain';

function skills(): SkillManifest[] {
  return [
    {
      id: 'install-package',
      name: 'Instalar pacote',
      description: 'pacman idempotente',
      category: 'package',
      riskLevel: 'high',
      scriptPath: 'install-package.sh',
      trusted: false,
    },
    {
      id: 'repair-audio',
      name: 'Reparar áudio',
      description: 'reinicia pipewire',
      category: 'audio',
      riskLevel: 'medium',
      scriptPath: 'repair-audio.sh',
      trusted: false,
    },
  ];
}

function softwarePlan(): SkillExecutionPlan {
  return {
    skillId: 'install-package',
    kind: 'software',
    mode: 'vm_tested',
    requiresManualApproval: false,
    supportsDryRun: true,
    dryRunCommand: 'bash install-package.sh --dry-run jq',
    runCommand: 'bash install-package.sh jq',
    rationale: 'Skill de software (risco alto): elegível para teste em VM com rollback.',
    spokenSummary: 'Vou testar numa VM limpa com rollback antes de aplicar.',
  };
}

function hardwarePlan(): SkillExecutionPlan {
  return {
    skillId: 'repair-audio',
    kind: 'hardware',
    mode: 'manual_dry_run',
    requiresManualApproval: true,
    supportsDryRun: true,
    dryRunCommand: 'bash repair-audio.sh --dry-run',
    runCommand: 'bash repair-audio.sh',
    rationale: 'Skill de hardware (risco médio): exige dry-run e aprovação manual no host, sem VM.',
    spokenSummary: 'A skill mexe em hardware. Nada muda até você aprovar.',
  };
}

function passedReport(): SkillVmReport {
  return {
    skillId: 'install-package',
    snapshotName: 'snap-x',
    outcome: 'passed',
    exitCode: 0,
    stdoutTail: 'ok: jq instalado',
    stderrTail: '',
    rolledBack: false,
    steps: ['snapshot snap-x', 'run skill na VM', 'skill passou; limpando VM de teste'],
    alternatives: [],
    at: new Date().toISOString(),
  };
}

function baseHandlers() {
  return {
    onSelect: vi.fn(),
    onArgsChange: vi.fn(),
    onVmDomainChange: vi.fn(),
    onVmSshTargetChange: vi.fn(),
    onSpeak: vi.fn(),
    onDryRun: vi.fn(),
    onTestVm: vi.fn(),
    onManualConfirmChange: vi.fn(),
    onApproveHost: vi.fn(),
    onMarkTrusted: vi.fn(),
  };
}

describe('SkillsPanel', () => {
  it('lista skills e dispara seleção', () => {
    const handlers = baseHandlers();
    render(
      <SkillsPanel
        skills={skills()}
        args=""
        vmDomain="ailu-test-arch"
        vmSshTarget=""
        manualConfirmed={false}
        {...handlers}
      />,
    );
    expect(screen.getByText('Instalar pacote')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Reparar áudio'));
    expect(handlers.onSelect).toHaveBeenCalledWith('repair-audio');
  });

  it('skill de software mostra teste em VM e botão Ouvir', () => {
    const handlers = baseHandlers();
    render(
      <SkillsPanel
        skills={skills()}
        selectedSkillId="install-package"
        plan={softwarePlan()}
        args="jq"
        vmDomain="ailu-test-arch"
        vmSshTarget="root@10.0.0.2"
        manualConfirmed={false}
        {...handlers}
      />,
    );
    expect(screen.getByText('testável em VM')).toBeInTheDocument();
    expect(screen.getByText('Testar em VM')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Ouvir'));
    expect(handlers.onSpeak).toHaveBeenCalled();
  });

  it('skill de hardware exige confirmação manual antes de aprovar no host', () => {
    const handlers = baseHandlers();
    const { rerender } = render(
      <SkillsPanel
        skills={skills()}
        selectedSkillId="repair-audio"
        plan={hardwarePlan()}
        args=""
        vmDomain="ailu-test-arch"
        vmSshTarget=""
        manualConfirmed={false}
        {...handlers}
      />,
    );
    expect(screen.getByText('aprovação manual')).toBeInTheDocument();
    const approve = screen.getByText('Aprovar e executar no host');
    expect(approve).toBeDisabled();
    expect(screen.queryByText('Testar em VM')).not.toBeInTheDocument();

    rerender(
      <SkillsPanel
        skills={skills()}
        selectedSkillId="repair-audio"
        plan={hardwarePlan()}
        args=""
        vmDomain="ailu-test-arch"
        vmSshTarget=""
        manualConfirmed
        {...handlers}
      />,
    );
    expect(screen.getByText('Aprovar e executar no host')).toBeEnabled();
  });

  it('relatório aprovado oferece marcar como confiável', () => {
    const handlers = baseHandlers();
    render(
      <SkillsPanel
        skills={skills()}
        selectedSkillId="install-package"
        plan={softwarePlan()}
        report={passedReport()}
        args="jq"
        vmDomain="ailu-test-arch"
        vmSshTarget="root@10.0.0.2"
        manualConfirmed={false}
        {...handlers}
      />,
    );
    expect(screen.getByText('Passou na VM')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Marcar como confiável'));
    expect(handlers.onMarkTrusted).toHaveBeenCalled();
  });
});
