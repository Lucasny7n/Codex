import { Badge } from '../common/Badge';
import { formatDateTime } from '../../lib/utils/format';
import type {
  SkillExecutionPlan,
  SkillManifest,
  SkillVmOutcome,
  SkillVmReport,
} from '../../types/domain';

interface SkillsPanelProps {
  skills: SkillManifest[];
  selectedSkillId?: string;
  plan?: SkillExecutionPlan;
  report?: SkillVmReport;
  args: string;
  vmDomain: string;
  vmSshTarget: string;
  manualConfirmed: boolean;
  busy?: boolean;
  speaking?: boolean;
  error?: string;
  onSelect: (id: string) => void;
  onArgsChange: (value: string) => void;
  onVmDomainChange: (value: string) => void;
  onVmSshTargetChange: (value: string) => void;
  onSpeak: () => void;
  onDryRun: () => void;
  onTestVm: () => void;
  onManualConfirmChange: (value: boolean) => void;
  onApproveHost: () => void;
  onMarkTrusted: () => void;
}

function riskTone(level: SkillManifest['riskLevel']): 'info' | 'warn' | 'danger' | 'ok' {
  if (level === 'low') return 'ok';
  if (level === 'medium') return 'info';
  if (level === 'high') return 'warn';
  return 'danger';
}

function outcomeTone(outcome: SkillVmOutcome): 'ok' | 'warn' | 'danger' {
  if (outcome === 'passed') return 'ok';
  if (outcome === 'rolled_back') return 'warn';
  return 'danger';
}

function outcomeLabel(outcome: SkillVmOutcome): string {
  if (outcome === 'passed') return 'Passou na VM';
  if (outcome === 'rolled_back') return 'Revertido (rollback)';
  return 'Bloqueado';
}

export function SkillsPanel({
  skills,
  selectedSkillId,
  plan,
  report,
  args,
  vmDomain,
  vmSshTarget,
  manualConfirmed,
  busy = false,
  speaking = false,
  error,
  onSelect,
  onArgsChange,
  onVmDomainChange,
  onVmSshTargetChange,
  onSpeak,
  onDryRun,
  onTestVm,
  onManualConfirmChange,
  onApproveHost,
  onMarkTrusted,
}: SkillsPanelProps): JSX.Element {
  const isHardware = plan?.kind === 'hardware';
  const isSoftware = plan?.kind === 'software';
  const passed = report?.outcome === 'passed';
  const trusted = skills.find((skill) => skill.id === selectedSkillId)?.trusted ?? false;

  return (
    <section className="panel skills-panel">
      <header className="panel-header">
        <h2>Skills</h2>
        <Badge tone={skills.length > 0 ? 'info' : 'neutral'}>{skills.length}</Badge>
      </header>
      <div className="panel-body skills-layout">
        <aside className="skills-list scroll-y" aria-label="Lista de skills">
          {skills.length === 0 ? (
            <div className="empty-state empty-state-inline">
              <strong>Nenhuma skill</strong>
              <span>Adicione scripts versionados em <code>skills/</code>.</span>
            </div>
          ) : null}
          {skills.map((skill) => (
            <button
              key={skill.id}
              type="button"
              className={`skill-item${selectedSkillId === skill.id ? ' active' : ''}`}
              onClick={() => onSelect(skill.id)}
            >
              <div className="row-between">
                <strong>{skill.name}</strong>
                {skill.trusted ? <Badge tone="ok">confiável</Badge> : <Badge tone="neutral">nova</Badge>}
              </div>
              <span className="muted">{skill.description}</span>
              <div className="skill-item-badges">
                <Badge tone="info">{skill.category}</Badge>
                <Badge tone={riskTone(skill.riskLevel)}>risco {skill.riskLevel}</Badge>
              </div>
            </button>
          ))}
        </aside>

        <div className="skill-detail scroll-y">
          {error ? <div className="skill-error" role="alert">{error}</div> : null}
          {!plan ? (
            <div className="empty-state empty-state-inline">
              <strong>Selecione uma skill</strong>
              <span>Você lê o que vai rodar antes de aprovar. Nada executa sozinho.</span>
            </div>
          ) : (
            <article className="skill-plan">
              <div className="permission-badges">
                <Badge tone={isHardware ? 'danger' : 'info'}>
                  {isHardware ? 'hardware' : 'software'}
                </Badge>
                <Badge tone={isSoftware ? 'ok' : 'warn'}>
                  {plan.mode === 'vm_tested' ? 'testável em VM' : 'aprovação manual'}
                </Badge>
                {trusted ? <Badge tone="ok">confiável</Badge> : null}
              </div>

              <p className="skill-rationale">{plan.rationale}</p>

              <div className="skill-spoken">
                <p>{plan.spokenSummary}</p>
                <button
                  type="button"
                  className="btn-modern"
                  onClick={onSpeak}
                  aria-pressed={speaking}
                >
                  {speaking ? 'Falando…' : 'Ouvir'}
                </button>
              </div>

              <label className="skill-field">
                <span>Argumentos</span>
                <input
                  type="text"
                  value={args}
                  placeholder={isHardware ? '(sem argumentos)' : 'ex: ripgrep jq'}
                  onChange={(event) => onArgsChange(event.target.value)}
                  spellCheck={false}
                />
              </label>

              <div className="skill-command-block">
                <span className="muted">dry-run</span>
                <pre className="command-preview">{plan.dryRunCommand}</pre>
                <span className="muted">execução real</span>
                <pre className="command-preview">{plan.runCommand}</pre>
              </div>

              <div className="row-actions">
                <button type="button" className="btn-modern" onClick={onDryRun} disabled={busy}>
                  Dry-run
                </button>
              </div>

              {isSoftware ? (
                <div className="skill-vm-config">
                  <h3 className="panel-subtitle">Teste em VM (snapshot + rollback)</h3>
                  <label className="skill-field">
                    <span>Domínio libvirt</span>
                    <input
                      type="text"
                      value={vmDomain}
                      placeholder="ailu-test-arch"
                      onChange={(event) => onVmDomainChange(event.target.value)}
                      spellCheck={false}
                    />
                  </label>
                  <label className="skill-field">
                    <span>SSH da VM</span>
                    <input
                      type="text"
                      value={vmSshTarget}
                      placeholder="root@192.168.122.10"
                      onChange={(event) => onVmSshTargetChange(event.target.value)}
                      spellCheck={false}
                    />
                  </label>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn-modern btn-modern-primary"
                      onClick={onTestVm}
                      disabled={busy || !vmDomain.trim() || !vmSshTarget.trim()}
                    >
                      {busy ? 'Testando…' : 'Testar em VM'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="skill-manual-approval">
                  <h3 className="panel-subtitle">Aprovação manual no host</h3>
                  <p className="muted">
                    Skill de hardware não roda em VM. Rode o dry-run, ouça o resumo e aprove
                    explicitamente.
                  </p>
                  <label className="skill-confirm">
                    <input
                      type="checkbox"
                      checked={manualConfirmed}
                      onChange={(event) => onManualConfirmChange(event.target.checked)}
                    />
                    <span>Li o que vai rodar e aprovo executar no host.</span>
                  </label>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn-modern btn-danger"
                      onClick={onApproveHost}
                      disabled={busy || !manualConfirmed}
                    >
                      Aprovar e executar no host
                    </button>
                  </div>
                </div>
              )}

              {report ? (
                <article className="skill-report">
                  <div className="row-between">
                    <Badge tone={outcomeTone(report.outcome)}>{outcomeLabel(report.outcome)}</Badge>
                    <small>{formatDateTime(report.at)}</small>
                  </div>
                  <div className="permission-facts">
                    <span>exit</span>
                    <strong>{report.exitCode ?? '—'}</strong>
                    <span>rollback</span>
                    <strong>{report.rolledBack ? 'sim' : 'não'}</strong>
                  </div>
                  {report.steps.length > 0 ? (
                    <ol className="skill-steps">
                      {report.steps.map((step, index) => (
                        <li key={`${step}-${index}`}>{step}</li>
                      ))}
                    </ol>
                  ) : null}
                  {report.stdoutTail ? (
                    <pre className="terminal-snippet">stdout: {report.stdoutTail}</pre>
                  ) : null}
                  {report.stderrTail ? (
                    <pre className="terminal-snippet stream-stderr">stderr: {report.stderrTail}</pre>
                  ) : null}
                  {report.alternatives.length > 0 ? (
                    <div className="skill-alternatives">
                      <strong>Alternativas</strong>
                      <ul>
                        {report.alternatives.map((alt, index) => (
                          <li key={`${alt}-${index}`}>{alt}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {passed ? (
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn-modern btn-modern-primary"
                        onClick={onMarkTrusted}
                        disabled={busy}
                      >
                        Marcar como confiável
                      </button>
                    </div>
                  ) : null}
                </article>
              ) : null}
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
