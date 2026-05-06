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
}

type InputMode = 'order' | 'terminal' | 'action';

export function CommandInputPanel({
  busy,
  privilegedActions,
  onSendOrder,
  onExecuteCommand,
  onRequestPrivilegedAction,
  actionJsonExamples,
  orderDisabledReason
}: CommandInputPanelProps): JSX.Element {
  const [mode, setMode] = useState<InputMode>('order');
  const [prompt, setPrompt] = useState('');
  const [command, setCommand] = useState('');
  const [selectedActionId, setSelectedActionId] = useState(privilegedActions[0]?.id ?? '');
  const [actionArgsText, setActionArgsText] = useState('{}');
  const [actionDryRun, setActionDryRun] = useState(true);

  const [error, setError] = useState<string>();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const activeActionId = selectedActionId || privilegedActions[0]?.id || '';
  const displayedActionArgsText =
    !selectedActionId && actionArgsText === '{}'
      ? actionJsonExamples[activeActionId] || actionArgsText
      : actionArgsText;

  const selectedAction = useMemo(
    () => privilegedActions.find((action) => action.id === activeActionId),
    [activeActionId, privilegedActions]
  );

  const canSubmit =
    !busy &&
    ((mode === 'order' && prompt.trim().length > 0 && !orderDisabledReason) ||
      (mode === 'terminal' && command.trim().length > 0) ||
      (mode === 'action' && activeActionId.length > 0));

  const handleSend = async () => {
    setError(undefined);
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
          setError('Escolha uma ação antes de solicitar permissão.');
          return;
        }
        const parsed: unknown = JSON.parse(displayedActionArgsText);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          setError('JSON de argumentos precisa ser um objeto.');
          return;
        }
        args = parsed as Record<string, unknown>;
      } catch {
        setError('JSON de argumentos inválido. Verifique o formato.');
        return;
      }
      await onRequestPrivilegedAction(activeActionId, args, actionDryRun);
    }
  };

  const handleCopyJson = async () => {
    setError(undefined);
    setCopyState('idle');
    try {
      await navigator.clipboard.writeText(displayedActionArgsText);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1400);
    } catch {
      setCopyState('failed');
      setError('Não foi possível copiar o JSON.');
    }
  };

  return (
    <section className="command-input-panel">
      <div className="command-panel-header">
        <div>
          <h2>Ordem e Execução</h2>
          <p>Envie trabalho, rode comandos ou solicite ações controladas.</p>
        </div>
        {busy ? <span className="live-chip">processando</span> : <span className="live-chip idle">pronto</span>}
      </div>

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

      {error && (
        <div className="input-error-tip" role="alert">
          {error}
        </div>
      )}

      {mode === 'order' && orderDisabledReason ? (
        <div className="input-error-tip provider-blocked-tip" role="status">
          {orderDisabledReason}
        </div>
      ) : null}

      <div className="input-container">
        {mode === 'order' && (
          <textarea
            className="input-modern main-input"
            placeholder="Descreva a tarefa com objetivo, risco e validação esperada."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
          />
        )}

        {mode === 'terminal' && (
          <textarea
            className="input-modern terminal-input"
            placeholder="Comando de terminal"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            rows={2}
          />
        )}

        {mode === 'action' && (
          <div className="privileged-input-stack">
            <select 
              className="input-modern" 
              value={activeActionId}
              onChange={(e) => {
                setSelectedActionId(e.target.value);
                setActionArgsText(actionJsonExamples[e.target.value] || '{}');
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
              onChange={(e) => setActionArgsText(e.target.value)}
              rows={4}
            />

            <label className="checkbox-modern">
              <input 
                type="checkbox" 
                checked={actionDryRun} 
                onChange={(e) => setActionDryRun(e.target.checked)} 
              />
              Dry-run
            </label>
          </div>
        )}
      </div>

      <div className="input-actions">
        {mode === 'action' ? (
          <button className="btn-modern" type="button" onClick={() => void handleCopyJson()}>
            {copyState === 'copied' ? 'JSON copiado' : copyState === 'failed' ? 'Falhou' : 'Copiar JSON'}
          </button>
        ) : null}
        <button 
          className="btn-modern btn-modern-primary" 
          disabled={!canSubmit}
          onClick={() => void handleSend()}
        >
          {busy ? 'Processando...' : mode === 'action' ? 'Solicitar aprovação' : mode === 'terminal' ? 'Executar comando' : 'Enviar ordem'}
        </button>
      </div>
    </section>
  );
}
