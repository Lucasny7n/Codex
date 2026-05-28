import { useCallback, useEffect, useState } from 'react';
import { PremiumModal } from '../common/PremiumUI';
import { SkillsPanel } from './SkillsPanel';
import {
  listSkills,
  planSkill,
  markSkillTrusted,
  testSkillInVm,
  requestExecution,
  listUserSkills,
  saveUserSkill,
  deleteUserSkill,
  dryRunUserSkill,
} from '../../lib/api';
import type {
  SkillExecutionPlan,
  SkillManifest,
  SkillVmReport,
  RiskLevel,
  UserSkill,
  UserSkillDryRun,
} from '../../types/domain';
import { parseSkillContent } from '../../lib/skills/localSkillStore';

type StudioTab = 'skills' | 'import' | 'create-text' | 'create-ai';

const STUDIO_TABS: Array<{ id: StudioTab; label: string }> = [
  { id: 'skills', label: 'Minhas Skills' },
  { id: 'import', label: 'Importar' },
  { id: 'create-text', label: 'Criar por texto' },
  { id: 'create-ai', label: 'Criar com IA' },
];

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
  const [activeTab, setActiveTab] = useState<StudioTab>('skills');
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
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState<string>();
  const [importDraftOk, setImportDraftOk] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createRisk, setCreateRisk] = useState<RiskLevel>('medium');
  const [createText, setCreateText] = useState('');
  const [localSkills, setLocalSkills] = useState<UserSkill[]>([]);
  const [localDryRunId, setLocalDryRunId] = useState<string>();
  const [localDryRun, setLocalDryRun] = useState<UserSkillDryRun>();
  const [aiChatHistory, setAiChatHistory] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
  const [aiInput, setAiInput] = useState('');

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
        const [repoSkills, userSkills] = await Promise.all([listSkills(), listUserSkills()]);
        if (active) {
          setSkills(repoSkills);
          setLocalSkills(userSkills);
        }
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

  function analyzeImport(): void {
    const raw = importText.trim();
    if (!raw) {
      setImportPreview(undefined);
      setImportDraftOk(false);
      return;
    }
    const parsed = parseSkillContent(raw);
    const lines = [
      `Nome: ${parsed.draft.name}`,
      `Risco: ${parsed.draft.risk ?? 'medium'}`,
      '',
      ...parsed.notes,
    ];
    setImportPreview(lines.join('\n'));
    setImportDraftOk(parsed.ok);
  }

  async function saveImportedSkill(): Promise<void> {
    const parsed = parseSkillContent(importText.trim());
    if (!parsed.ok) {
      onToast('error', 'Conteúdo inválido para importar.');
      return;
    }
    try {
      setLocalSkills(await saveUserSkill(parsed.draft));
      setImportText('');
      setImportPreview(undefined);
      setImportDraftOk(false);
      setActiveTab('skills');
      onToast('success', 'Skill importada e salva. Revise antes de testar.');
    } catch (cause) {
      onToast('error', cause instanceof Error ? cause.message : 'Falha ao salvar skill importada.');
    }
  }

  async function saveCreatedSkill(): Promise<void> {
    const name = createName.trim();
    const content = createText.trim();
    if (!name || !content) {
      onToast('error', 'Informe nome e conteúdo da skill.');
      return;
    }
    try {
      setLocalSkills(await saveUserSkill({
        name,
        description: createDescription.trim(),
        content,
        risk: createRisk,
        source: 'manual',
      }));
      setCreateName('');
      setCreateDescription('');
      setCreateText('');
      setCreateRisk('medium');
      setActiveTab('skills');
      onToast('success', 'Skill criada e salva. Nada executa sem aprovação.');
    } catch (cause) {
      onToast('error', cause instanceof Error ? cause.message : 'Falha ao salvar skill.');
    }
  }

  async function removeLocalSkill(id: string): Promise<void> {
    try {
      setLocalSkills(await deleteUserSkill(id));
      if (localDryRunId === id) {
        setLocalDryRunId(undefined);
        setLocalDryRun(undefined);
      }
      onToast('info', 'Skill removida.');
    } catch (cause) {
      onToast('error', cause instanceof Error ? cause.message : 'Falha ao remover skill.');
    }
  }

  async function toggleLocalDryRun(id: string): Promise<void> {
    if (localDryRunId === id) {
      setLocalDryRunId(undefined);
      setLocalDryRun(undefined);
      return;
    }
    try {
      const report = await dryRunUserSkill(id);
      setLocalDryRunId(id);
      setLocalDryRun(report);
    } catch (cause) {
      onToast('error', cause instanceof Error ? cause.message : 'Falha ao gerar dry-run.');
    }
  }

  function addAiMessage(role: 'user' | 'assistant', text: string): void {
    setAiChatHistory((prev) => [...prev, { role, text }]);
  }

  function handleAiSend(): void {
    const msg = aiInput.trim();
    if (!msg) return;
    setAiInput('');
    addAiMessage('user', msg);
    // Placeholder response — full AI creation requires backend integration
    const lowerMsg = msg.toLowerCase();
    let response = '';
    if (lowerMsg.includes('áudio') || lowerMsg.includes('audio')) {
      response = 'Para uma skill de áudio, vou precisar saber:\n1. Qual ação específica? (reiniciar, diagnosticar, ajustar volume…)\n2. É só para PipeWire/PulseAudio ou também ALSA?\n3. Precisa de rollback automático?\n\nResposta da IA completa requer provider configurado.';
    } else if (lowerMsg.includes('bluetooth')) {
      response = 'Para skill de Bluetooth:\n1. Ação pretendida? (reparar, parear, reiniciar…)\n2. Apenas systemd/bluetoothd ou também rfkill?\n\nResposta da IA completa requer provider configurado.';
    } else if (lowerMsg.includes('rede') || lowerMsg.includes('network')) {
      response = 'Para skill de rede:\n1. NetworkManager, wpa_supplicant ou outra?\n2. Tem dry-run seguro (ex.: verificar rotas sem mudar)?\n\nResposta da IA completa requer provider configurado.';
    } else {
      response = `Entendido: "${msg}"\n\nPara gerar a skill completa, preciso saber:\n- Qual o objetivo principal?\n- Quais comandos são necessários?\n- Há risco de perda de dados?\n\nNote: resposta completa da IA requer um provider configurado em Configurações.`;
    }
    setTimeout(() => addAiMessage('assistant', response), 400);
  }

  if (!open) return null;

  return (
    <PremiumModal
      open={open}
      title="Skill Studio"
      description="Gerencie, importe e crie skills de automação com segurança."
      onClose={onClose}
      className="skill-studio-modal"
    >
      <div className="skill-studio-tabs" role="tablist" aria-label="Seções do Skill Studio">
        {STUDIO_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`skill-studio-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.id === 'skills' && skills.length > 0 ? (
              <span className="skill-studio-tab-count">{skills.length}</span>
            ) : null}
          </button>
        ))}
      </div>

      {activeTab === 'skills' ? (
        skills.length === 0 && localSkills.length === 0 ? (
          <div className="skill-empty-state empty-state">
            <strong>Nenhuma skill ainda</strong>
            <p>Skills são automações revisáveis. Toda skill passa por dry-run e aprovação antes de rodar — nada executa sozinho.</p>
            <div className="skill-empty-actions">
              <button type="button" className="btn-modern btn-modern-primary" onClick={() => setActiveTab('import')}>Importar</button>
              <button type="button" className="btn-modern" onClick={() => setActiveTab('create-text')}>Criar por texto</button>
              <button type="button" className="btn-modern" onClick={() => setActiveTab('create-ai')}>Criar com IA</button>
            </div>
          </div>
        ) : (
          <>
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
            {localSkills.length > 0 ? (
              <section className="local-skills-section">
                <h4 className="settings-section-label">Skills locais (você criou ou importou)</h4>
                <p className="local-skills-note">Salvas neste dispositivo. Execução real exige backend + aprovação; aqui o teste é um dry-run simulado.</p>
                {localSkills.map((skill) => (
                  <article key={skill.id} className="local-skill-card">
                    <header>
                      <strong>{skill.name}</strong>
                      <span className={`local-skill-risk risk-${skill.risk}`}>risco {skill.risk}</span>
                    </header>
                    {skill.description ? <p className="local-skill-desc">{skill.description}</p> : null}
                    <div className="local-skill-meta">
                      <span>Origem: {skill.source === 'import' ? 'importada' : skill.source === 'ai' ? 'criada com IA' : 'criada por texto'}</span>
                      <span>Permissões: {skill.permissions.length ? skill.permissions.join(', ') : 'nenhuma declarada'}</span>
                    </div>
                    <div className="local-skill-actions">
                      <button type="button" className="btn-modern" onClick={() => void toggleLocalDryRun(skill.id)}>
                        {localDryRunId === skill.id ? 'Ocultar dry-run' : 'Testar (dry-run)'}
                      </button>
                      <button type="button" className="btn-modern danger" onClick={() => void removeLocalSkill(skill.id)}>Remover</button>
                    </div>
                    {localDryRunId === skill.id && localDryRun ? (
                      <div className="local-skill-dryrun-block" role="status">
                        <p className="local-skill-dryrun-summary">{localDryRun.summary}</p>
                        {localDryRun.requiresApproval ? (
                          <p className="local-skill-dryrun-approval">Esta skill exige aprovação explícita antes de qualquer execução real.</p>
                        ) : null}
                        <pre className="local-skill-dryrun">{localDryRun.preview}</pre>
                      </div>
                    ) : null}
                  </article>
                ))}
              </section>
            ) : null}
          </>
        )
      ) : null}

      {activeTab === 'import' ? (
        <div className="skill-import-panel">
          <p className="skill-import-intro">
            Cole um manifest JSON (<code>.json</code>), script shell (<code>.sh</code>) ou conteúdo de texto.
            O conteúdo será analisado antes de salvar. Nenhuma skill é confiada automaticamente.
          </p>
          <textarea
            className="skill-import-textarea"
            value={importText}
            onChange={(e) => { setImportText(e.target.value); setImportPreview(undefined); }}
            placeholder={`Cole aqui o conteúdo da skill.\nExemplos:\n  { "id": "minha-skill", "name": "Minha Skill", ... }\n  #!/usr/bin/env bash\n  # skill: minha-skill\n  ...`}
            rows={10}
          />
          <div className="skill-import-actions">
            <button
              type="button"
              className="btn-modern"
              disabled={!importText.trim()}
              onClick={analyzeImport}
            >
              Analisar
            </button>
            {importDraftOk ? (
              <button type="button" className="btn-modern btn-modern-primary" onClick={saveImportedSkill}>
                Salvar skill importada
              </button>
            ) : null}
          </div>
          {importPreview ? (
            <div className="skill-import-preview">
              <strong>Análise</strong>
              <pre>{importPreview}</pre>
              <p className="skill-import-warning">
                A skill é salva localmente neste dispositivo após revisão. Execução real exige backend + aprovação explícita — o teste local é um dry-run simulado.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'create-text' ? (
        <div className="skill-create-panel">
          <p className="skill-import-intro">
            Crie uma skill manualmente. Ela fica salva neste dispositivo e nunca executa sem aprovação.
          </p>
          <label className="skill-create-field">
            <span>Nome</span>
            <input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Reiniciar rede" />
          </label>
          <label className="skill-create-field">
            <span>Descrição</span>
            <input value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} placeholder="O que a skill faz e quando usar" />
          </label>
          <label className="skill-create-field">
            <span>Risco</span>
            <select value={createRisk} onChange={(e) => setCreateRisk(e.target.value as RiskLevel)}>
              <option value="low">Baixo</option>
              <option value="medium">Médio</option>
              <option value="high">Alto</option>
              <option value="critical">Crítico</option>
            </select>
          </label>
          <label className="skill-create-field">
            <span>Conteúdo (script ou passos)</span>
            <textarea
              className="skill-import-textarea"
              value={createText}
              onChange={(e) => setCreateText(e.target.value)}
              placeholder={'#!/usr/bin/env bash\n# Inclua um modo --dry-run que apenas mostra o que faria.'}
              rows={8}
            />
          </label>
          <div className="skill-import-actions">
            <button
              type="button"
              className="btn-modern btn-modern-primary"
              disabled={!createName.trim() || !createText.trim()}
              onClick={saveCreatedSkill}
            >
              Salvar skill
            </button>
          </div>
          <p className="skill-import-warning">
            Salva localmente. Para gerar conteúdo com IA, use a aba "Criar com IA" (requer provider configurado).
          </p>
        </div>
      ) : null}

      {activeTab === 'create-ai' ? (
        <div className="skill-ai-panel">
          <div className="skill-ai-chat scroll-y">
            {aiChatHistory.length === 0 ? (
              <div className="skill-ai-intro">
                <strong>Criar skill com IA</strong>
                <p>Descreva o objetivo da skill. O Ailu vai fazer perguntas, entender o contexto e gerar o script com dry-run e análise de risco.</p>
                <p className="skill-import-warning">Requer provider de IA configurado para respostas completas.</p>
              </div>
            ) : null}
            {aiChatHistory.map((msg, index) => (
              <div key={index} className={`skill-ai-message skill-ai-${msg.role}`}>
                <pre>{msg.text}</pre>
              </div>
            ))}
          </div>
          <div className="skill-ai-input-row">
            <input
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Descreva o objetivo da skill…"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiSend(); } }}
            />
            <button
              type="button"
              className="btn-modern btn-modern-primary"
              disabled={!aiInput.trim()}
              onClick={handleAiSend}
            >
              Enviar
            </button>
          </div>
        </div>
      ) : null}
    </PremiumModal>
  );
}
