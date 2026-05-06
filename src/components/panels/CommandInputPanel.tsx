import { useState } from 'react';
import type { PrivilegedActionSpec } from '../../types/domain';

interface CommandInputPanelProps {
  busy: boolean;
  privilegedActions: PrivilegedActionSpec[];
  onSendOrder: (order: string) => Promise<void>;
  onExecuteCommand: (command: string) => Promise<void>;
  onRequestPrivilegedAction: (actionId: string, args: Record<string, unknown>, dryRun: boolean) => Promise<void>;
  actionJsonExamples: Record<string, string>;
}

type InputMode = 'order' | 'terminal' | 'action';

export function CommandInputPanel({
  busy,
  privilegedActions,
  onSendOrder,
  onExecuteCommand,
  onRequestPrivilegedAction,
  actionJsonExamples
}: CommandInputPanelProps): JSX.Element {
  const [mode, setMode] = useState<InputMode>('order');
  const [prompt, setPrompt] = useState('');
  const [command, setCommand] = useState('');
  const [selectedActionId, setSelectedActionId] = useState('');
  const [actionArgsText, setActionArgsText] = useState('{}');
  const [actionDryRun, setActionDryRun] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const [error, setError] = useState<string>();

  // Sincroniza ação selecionada quando o catálogo carregar sem usar useEffect (evita cascading renders)
  const [prevActions, setPrevActions] = useState(privilegedActions);
  if (privilegedActions !== prevActions) {
    setPrevActions(privilegedActions);
    if (privilegedActions.length > 0 && !selectedActionId) {
      const firstId = privilegedActions[0].id;
      setSelectedActionId(firstId);
      setActionArgsText(actionJsonExamples[firstId] || '{}');
    }
  }

  const handleCopyExample = async () => {
    const example = actionJsonExamples[selectedActionId] || '{}';
    try {
      await navigator.clipboard.writeText(example);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      // Fallback silencioso se clipboard falhar
    }
  };

  const [error, setError] = useState<string>();

  const handleSend = async () => {
    setError(undefined);
    if (mode === 'order') {
      await onSendOrder(prompt);
      setPrompt('');
    } else if (mode === 'terminal') {
      await onExecuteCommand(command);
      setCommand('');
    } else {
      if (!selectedActionId) {
        setError('Nenhuma ação selecionada.');
        return;
      }
      try {
        const parsed = JSON.parse(actionArgsText);
        
        // Validação rigorosa: deve ser objeto puro, não array, null, string, etc.
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          setError('JSON inválido: os argumentos devem ser um objeto {}.');
          return;
        }

        await onRequestPrivilegedAction(selectedActionId, parsed, actionDryRun);
      } catch {
        setError('JSON de argumentos inválido. Verifique o formato.');
      }
    }
  };

  return (
    <section className="command-input-panel">
      {error && (
        <div className="input-error-tip">
          {error}
        </div>
      )}
      <div className="mode-selector">
        <button 
          className={`mode-tab ${mode === 'order' ? 'active' : ''}`} 
          onClick={() => setMode('order')}
        >
          Ordem
        </button>
        <button 
          className={`mode-tab ${mode === 'terminal' ? 'active' : ''}`} 
          onClick={() => setMode('terminal')}
        >
          Terminal
        </button>
        <button 
          className={`mode-tab ${mode === 'action' ? 'active' : ''}`} 
          onClick={() => setMode('action')}
        >
          Ação Privilegiada
        </button>
      </div>

      <div className="input-container">
        {mode === 'order' && (
          <textarea
            className="input-modern main-input"
            placeholder="Diga ao agente o que fazer..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
          />
        )}

        {mode === 'terminal' && (
          <textarea
            className="input-modern terminal-input"
            placeholder="Comando de terminal (ex: npm run test)"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            rows={2}
          />
        )}

        {mode === 'action' && (
          <div className="privileged-input-stack">
            <div className="action-select-row" style={{ display: 'flex', gap: '8px' }}>
              <select 
                className="input-modern" 
                value={selectedActionId} 
                onChange={(e) => {
                  setSelectedActionId(e.target.value);
                  setActionArgsText(actionJsonExamples[e.target.value] || '{}');
                }}
              >
                {!selectedActionId && <option value="">Selecione uma ação...</option>}
                {privilegedActions.map((action) => (
                  <option key={action.id} value={action.id}>
                    {action.title}
                  </option>
                ))}
              </select>
              <button 
                className="btn-modern" 
                title="Copiar JSON de exemplo"
                onClick={handleCopyExample}
                disabled={!selectedActionId}
              >
                {copyFeedback ? 'Copiado!' : 'Exemplo'}
              </button>
            </div>
            
            <textarea
              className="input-modern args-input"
              value={actionArgsText}
              onChange={(e) => setActionArgsText(e.target.value)}
              rows={4}
            />

            <label className="checkbox-modern">
              <input 
                type="checkbox" 
                checked={actionDryRun} 
                onChange={(e) => setActionDryRun(e.target.checked)} 
              />
              Modo Dry-Run (Seguro)
            </label>
          </div>
        )}
      </div>

      <div className="input-actions">
        <button 
          className="btn-modern btn-modern-primary" 
          disabled={busy || (mode === 'order' && !prompt) || (mode === 'terminal' && !command) || (mode === 'action' && !selectedActionId)}
          onClick={handleSend}
        >
          {busy ? 'Processando...' : mode === 'action' ? 'Solicitar Permissão' : 'Executar'}
        </button>
      </div>
    </section>
  );
}
