import { useCallback, useEffect, useState } from 'react';
import { PremiumModal } from '../common/PremiumUI';
import { SkillsPanel } from './SkillsPanel';
import {
  listSkills,
  planSkill,
  markSkillTrusted,
  testSkillInVm,
  requestExecution,
} from '../../lib/api';
import type { SkillExecutionPlan, SkillManifest, SkillVmReport } from '../../types/domain';

interface SkillStudioModalProps {
  open: boolean;
  sessionId?: string;
  onClose: () => void;
  onToast: (tone: 'success' | 'error' | 'info', message: string) => void;
}

function parseArgs(raw: string): string[] {
  return raw
    .trim()
    .split(/\s+/u)
    .filter((token) => token.length > 0);
}

function speak(text: string, onEnd: () => void): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR';
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

export function SkillStudioModal({ open, sessionId, onClose, onToast }: SkillStudioModalProps): JSX.Element | null {
  const [skills, setSkills] = useState<SkillManifest[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string>();
  const [plan, setPlan] = useState<SkillExecutionPlan>();
  const [report, setReport] = useState<SkillVmReport>();
  const [args, setArgs] = useState('');
  const [vmDomain, setVmDomain] = useState('ailu-test-arch');
  const [vmSshTarget, setVmSshTarget] = useState('');
  const [manualConfirmed, setManualConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string>();

  const refreshSkills = useCallback(async () => {
    try {
      setSkills(await listSkills());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao carregar skills.');
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    async function load(): Promise<void> {
      try {
        const next = await listSkills();
        if (active) setSkills(next);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Falha ao carregar skills.');
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!selectedSkillId) return undefined;
    let active = true;
    async function buildPlan(skillId: string): Promise<void> {
      try {
        const next = await planSkill(skillId, parseArgs(args));
        if (active) {
          setPlan(next);
          setError(undefined);
        }
      } catch (cause) {
        if (active) {
          setPlan(undefined);
          setError(cause instanceof Error ? cause.message : 'Falha ao montar o plano da skill.');
        }
      }
    }
    void buildPlan(selectedSkillId);
    return () => {
      active = false;
    };
  }, [selectedSkillId, args]);

  const handleSelect = useCallback((id: string) => {
    setSelectedSkillId(id);
    setReport(undefined);
    setManualConfirmed(false);
    setError(undefined);
  }, []);

  const handleSpeak = useCallback(() => {
    if (!plan) return;
    const started = speak(plan.spokenSummary, () => setSpeaking(false));
    if (started) {
      setSpeaking(true);
    } else {
      onToast('info', 'Síntese de voz indisponível neste ambiente.');
    }
  }, [plan, onToast]);

  const handleDryRun = useCallback(async () => {
    if (!plan || !sessionId) {
      onToast('info', 'Abra uma sessão para enviar o dry-run ao Centro de Aprovação.');
      return;
    }
    setBusy(true);
    try {
      await requestExecution({
        sessionId,
        command: plan.dryRunCommand,
        reason: `Dry-run da skill ${plan.skillId}`,
      });
      onToast('success', 'Dry-run enviado ao Centro de Aprovação.');
    } catch (cause) {
      onToast('error', cause instanceof Error ? cause.message : 'Falha ao enviar dry-run.');
    } finally {
      setBusy(false);
    }
  }, [plan, sessionId, onToast]);

  const handleTestVm = useCallback(async () => {
    if (!selectedSkillId) return;
    setBusy(true);
    setReport(undefined);
    try {
      const next = await testSkillInVm(selectedSkillId, parseArgs(args), vmDomain.trim(), vmSshTarget.trim());
      setReport(next);
      if (next.outcome === 'passed') {
        onToast('success', 'Skill passou no teste em VM.');
      } else if (next.outcome === 'rolled_back') {
        onToast('info', 'Erro detectado na VM: rollback aplicado.');
      } else {
        onToast('error', 'Teste em VM bloqueado.');
      }
    } catch (cause) {
      onToast('error', cause instanceof Error ? cause.message : 'Falha no teste em VM.');
    } finally {
      setBusy(false);
    }
  }, [selectedSkillId, args, vmDomain, vmSshTarget, onToast]);

  const handleApproveHost = useCallback(async () => {
    if (!plan || !sessionId) {
      onToast('info', 'Abra uma sessão para executar no host.');
      return;
    }
    setBusy(true);
    try {
      await requestExecution({
        sessionId,
        command: plan.runCommand,
        reason: `Execução aprovada da skill ${plan.skillId}`,
      });
      onToast('success', 'Enviado ao Centro de Aprovação para execução no host.');
      setManualConfirmed(false);
    } catch (cause) {
      onToast('error', cause instanceof Error ? cause.message : 'Falha ao enviar execução.');
    } finally {
      setBusy(false);
    }
  }, [plan, sessionId, onToast]);

  const handleMarkTrusted = useCallback(async () => {
    if (!selectedSkillId) return;
    setBusy(true);
    try {
      await markSkillTrusted(selectedSkillId);
      await refreshSkills();
      onToast('success', 'Skill marcada como confiável.');
    } catch (cause) {
      onToast('error', cause instanceof Error ? cause.message : 'Falha ao marcar confiável.');
    } finally {
      setBusy(false);
    }
  }, [selectedSkillId, refreshSkills, onToast]);

  if (!open) return null;

  return (
    <PremiumModal
      open={open}
      title="Skill Studio"
      description="Leia, ouça e aprove. Software testa em VM com rollback; hardware exige aprovação manual."
      onClose={onClose}
      className="skill-studio-modal"
    >
      <SkillsPanel
        skills={skills}
        selectedSkillId={selectedSkillId}
        plan={plan}
        report={report}
        args={args}
        vmDomain={vmDomain}
        vmSshTarget={vmSshTarget}
        manualConfirmed={manualConfirmed}
        busy={busy}
        speaking={speaking}
        error={error}
        onSelect={handleSelect}
        onArgsChange={setArgs}
        onVmDomainChange={setVmDomain}
        onVmSshTargetChange={setVmSshTarget}
        onSpeak={handleSpeak}
        onDryRun={handleDryRun}
        onTestVm={handleTestVm}
        onManualConfirmChange={setManualConfirmed}
        onApproveHost={handleApproveHost}
        onMarkTrusted={handleMarkTrusted}
      />
    </PremiumModal>
  );
}
