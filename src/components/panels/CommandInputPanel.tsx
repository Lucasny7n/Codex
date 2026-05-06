import { useMemo, useState } from 'react';
import type { PrivilegedActionSpec } from '../../types/domain';

interface CommandInputPanelProps {
  busy: boolean;
  privilegedActions: PrivilegedActionSpec[];
  onSendOrder: (order: string) => Promise<void>;
  onExecuteCommand: (command: string) => Promise<void>;
  onRequestPrivilegedAction: (actionId: string, args: Record<string, unknown>, dryRun: boolean) => Promise<void>;
  actionJsonExamples: Record<string, string>;
  orderDisabledReason?: string;
  executionMode?: 'cloud' | 'local';
  activeModelLabel?: string;
  providerLabel?: string;
  runtimeState?: string;
  onOpenModelSelector?: () => void;
}

type InputMode = 'order' | 'terminal' | 'action';

export function CommandInputPanel({
  busy,
  privilegedActions,
  onSendOrder,
  onExecuteCommand,
  onRequestPrivilegedAction,
  actionJsonExamples,
  orderDisabledReason,
  executionMode = 'cloud',
  activeModelLabel = 'modelo não selecionado',
  providerLabel,
  runtimeState,
  onOpenModelSelector,
}: CommandInputPanelProps): JSX.Element {
  const [mode, setMode] = useState<InputMode>('order');
  const [prompt, setPrompt] = useState('');
  const [command, setCommand] = useState('');
  const [selectedActionId, setSelectedActionId] = useState(privilegedActions[0]?.id ?? '');
  const [actionArgsText, setActionArgsText] = useState('{}');
  const [actionDryRun, setActionDryRun] = useState(true);

  const [sendError, setSendError] = useState<string>();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const activeActionId = selectedActionId || privilegedActions[0]?.id || '';
  const displayedActionArgsText =
    !selectedActionId && actionArgsText === '{}'
      ? actionJsonExamples[activeActionId] || actionArgsText
      : actionArgsText;

  const selectedAction = useMemo(
    () => privilegedActions.find((action) => action.id === activeActionId),
    [activeActionId, privilegedActions],
  );

  const canSubmit =
    !busy &&
    ((mode === 'order' && prompt.trim().length > 0 && !orderDisabledReason) ||
      (mode === 'terminal' && command.trim().length > 0) ||
      (mode === 'action' && activeActionId.length > 0));

  const handleSend = async () => {
    setSendError(undefined);
    if (mode === 'order') {
      await onSendOrder(prompt);
      setPrompt('');
    } else if (mode === 'terminal') {
      await onExecuteCommand(command);
      setCommand('');
    } else {
      let args: Record<string, unknown>;
      try {
        if (!activeActionId) {
          setSendError('Escolha uma ação antes de solicitar permissão.');
          return;
        }
        const parsed: unknown = JSON.parse(displayedActionArgsText);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          setSendError('JSON de argumentos precisa ser um objeto.');
          return;
        }
        args = parsed as Record<string, unknown>;
      } catch (cause) {
        const detail = cause instanceof Error ? cause.message : 'erro de parse desconhecido';
        setSendError(`JSON de argumentos inválido. Verifique o formato. Detalhe: ${detail}`);
        return;
      }
      await onRequestPrivilegedAction(activeActionId, args, actionDryRun);
    }
  };

  const handleCopyJson = async () => {
    setSendError(undefined);
    setCopyState('idle');
    try {
      await navigator.clipboard.writeText(displayedActionArgsText);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1400);
    } catch (cause) {
      setCopyState('failed');
      const detail = cause instanceof Error ? cause.message : 'clipboard indisponível';
      setSendError(`Não foi possível copiar o JSON. Detalhe: ${detail}`);
    }
  };

  return (
    <section className="command-input-panel">
      <div className="command-panel-header">
        <div>
          <h2>Comando Principal</h2>
          <p>Fluxo unificado para ordens, terminal e ações controladas.</p>
        </div>
        <div className="command-context-badges">
          <span className="live-chip">{busy ? 'executando' : 'pronto'}</span>
          <span className="context-chip">{executionMode === 'local' ? 'Local' : 'Nuvem'}</span>
          <span className="context-chip">{activeModelLabel}</span>
          {runtimeState ? <span className="context-chip">runtime: {runtimeState.replace('_', ' ')}</span> : null}
          {!runtimeState && providerLabel ? <span className="context-chip">provider: {providerLabel}</span> : null}
        </div>
      </div>

      <div className="command-toolbar">
        <div className="mode-selector" role="tablist" aria-label="Modo de entrada">
          <button
            className={`mode-tab ${mode === 'order' ? 'active' : ''}`}
            type="button"
            onClick={() => setMode('order')}
          >
            Ordem
          </button>
          <button
            className={`mode-tab ${mode === 'terminal' ? 'active' : ''}`}
            type="button"
            onClick={() => setMode('terminal')}
          >
            Terminal
          </button>
          <button
            className={`mode-tab ${mode === 'action' ? 'active' : ''}`}
            type="button"
            onClick={() => setMode('action')}
          >
            Ação
          </button>
        </div>

        <button type="button" className="btn-modern" onClick={onOpenModelSelector} disabled={!onOpenModelSelector}>
          Modelo / Execução
        </button>
      </div>

      {sendError ? (
        <div className="input-error-tip" role="alert">
          {sendError}
        </div>
      ) : null}

      {mode === 'order' && orderDisabledReason ? (
        <div className="input-error-tip provider-blocked-tip" role="status">
          {orderDisabledReason}
        </div>
      ) : null}

      <div className="input-container">
        {mode === 'order' ? (
          <textarea
            className="input-modern main-input"
            placeholder="Descreva objetivo, restrições, risco e validação esperada."
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={3}
          />
        ) : null}

        {mode === 'terminal' ? (
          <textarea
            className="input-modern terminal-input"
            placeholder="Comando de terminal"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            rows={2}
          />
        ) : null}

        {mode === 'action' ? (
          <div className="privileged-input-stack">
            <select
              className="input-modern"
              value={activeActionId}
              onChange={(event) => {
                setSelectedActionId(event.target.value);
                setActionArgsText(actionJsonExamples[event.target.value] || '{}');
              }}
            >
              {privilegedActions.map((action) => (
                <option key={action.id} value={action.id}>
                  {action.title}
                </option>
              ))}
            </select>

            {selectedAction ? (
              <div className="action-spec-card">
                <div className="row-between">
                  <strong>{selectedAction.category}</strong>
                  <span className={`risk-chip risk-${selectedAction.riskLevel}`}>{selectedAction.riskLevel}</span>
                </div>
                <p>{selectedAction.description}</p>
                <span>alvo: {selectedAction.targetHint}</span>
                {selectedAction.rollbackHint ? <span>reversão: {selectedAction.rollbackHint}</span> : null}
              </div>
            ) : null}

            <textarea
              className="input-modern args-input"
              value={displayedActionArgsText}
              onChange={(event) => setActionArgsText(event.target.value)}
              rows={4}
            />

            <label className="checkbox-modern">
              <input type="checkbox" checked={actionDryRun} onChange={(event) => setActionDryRun(event.target.checked)} />
              Dry-run
            </label>
          </div>
        ) : null}
      </div>

      <div className="input-actions">
        {mode === 'action' ? (
          <button className="btn-modern" type="button" onClick={() => void handleCopyJson()}>
            {copyState === 'copied' ? 'JSON copiado' : copyState === 'failed' ? 'Falhou' : 'Copiar JSON'}
          </button>
        ) : null}
        <button className="btn-modern btn-modern-primary" disabled={!canSubmit} onClick={() => void handleSend()}>
          {busy ? 'Processando...' : mode === 'action' ? 'Solicitar aprovação' : mode === 'terminal' ? 'Executar comando' : 'Enviar ordem'}
        </button>
      </div>
    </section>
  );
}
