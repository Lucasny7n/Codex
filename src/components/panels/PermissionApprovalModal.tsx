import { useState } from 'react';
import { PremiumModal } from '../common/PremiumUI';
import type { PermissionRequest } from '../../types/domain';

const RISK_BADGE: Record<string, { label: string; className: string }> = {
  low: { label: 'Baixo risco', className: 'risk-low' },
  medium: { label: 'Risco médio', className: 'risk-medium' },
  high: { label: 'Alto risco', className: 'risk-high' },
  critical: { label: 'Risco crítico', className: 'risk-critical' },
};

interface PermissionApprovalModalProps {
  permissions: PermissionRequest[];
  onDecide: (requestId: string, decision: 'allow_once' | 'deny_once') => Promise<void>;
}

export function PermissionApprovalModal({ permissions, onDecide }: PermissionApprovalModalProps): JSX.Element | null {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const pending = permissions.filter((p) => p.status === 'pending');
  const current = pending[0];

  if (!current) return null;

  const risk = RISK_BADGE[current.riskLevel] ?? { label: current.riskLevel, className: 'risk-medium' };
  const affectedTarget = current.target && current.target !== current.command ? current.target : undefined;

  async function copyCommand(): Promise<void> {
    try {
      await navigator.clipboard.writeText(current.command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable; copying is a convenience, not critical.
    }
  }

  async function decide(decision: 'allow_once' | 'deny_once'): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      await onDecide(current.id, decision);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PremiumModal
      open
      title="Aprovação necessária"
      description={`${pending.length > 1 ? `${pending.length} solicitações pendentes` : '1 solicitação pendente'}`}
      onClose={() => void decide('deny_once')}
      className="permission-modal"
    >
      <div className="permission-dialog">
        <div className="permission-header">
          <span className={`permission-risk-badge ${risk.className}`}>{risk.label}</span>
          <strong className="permission-title">{current.title}</strong>
        </div>

        <p className="permission-reason">{current.reason}</p>

        <div className="permission-command-block">
          <div className="permission-command-head">
            <span className="permission-command-label">Comando pretendido</span>
            <button type="button" className="permission-copy" onClick={() => void copyCommand()}>
              {copied ? 'Copiado' : 'Copiar comando'}
            </button>
          </div>
          <code className="permission-command">{current.command}</code>
          {current.cwd ? <span className="permission-cwd">em {current.cwd}</span> : null}
        </div>

        {affectedTarget ? (
          <div className="permission-target">
            <span>Arquivo / alvo afetado:</span>
            <code>{affectedTarget}</code>
          </div>
        ) : null}

        {current.rollback ? (
          <div className="permission-rollback">
            <span>Rollback disponível:</span>
            <code>{current.rollback}</code>
          </div>
        ) : null}

        {current.requiresHighConfirmation ? (
          <div className="permission-high-warn">
            Ação de alto impacto — revise com atenção antes de aprovar.
          </div>
        ) : null}

        <div className="permission-actions">
          <button
            type="button"
            className="btn-modern btn-modern-danger"
            disabled={busy}
            onClick={() => void decide('deny_once')}
          >
            Negar
          </button>
          <button
            type="button"
            className="btn-modern btn-modern-primary"
            disabled={busy}
            onClick={() => void decide('allow_once')}
          >
            {busy ? 'Aprovando…' : 'Aprovar e executar'}
          </button>
        </div>

        <p className="permission-policy-note">
          O Ailu sempre pede aprovação antes de executar ações deste tipo. Nada roda sem o seu OK.
        </p>

        {pending.length > 1 ? (
          <p className="permission-queue-note">
            Mais {pending.length - 1} solicitação(ões) aguardando depois desta.
          </p>
        ) : null}
      </div>
    </PremiumModal>
  );
}
