import { useMemo, useState } from 'react';
import type { PrivilegedActionSpec } from '../../types/domain';
import { PopupMenu } from '../common/PremiumUI';

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
  onOpenTerminal?: () => void;
}

type InputMode = 'Pensamento' | 'Rápido' | 'Código' | 'Terminal' | 'Agente';

const INPUT_MODES: InputMode[] = ['Pensamento', 'Rápido', 'Código', 'Terminal', 'Agente'];

export function CommandInputPanel({
  busy,
  privilegedActions,
  onSendOrder,
  onExecuteCommand,
  onRequestPrivilegedAction,
  actionJsonExamples,
  orderDisabledReason,
  onOpenModelSelector,
  onOpenTerminal,
}: CommandInputPanelProps): JSX.Element {
  const [mode, setMode] = useState<InputMode>('Pensamento');
  const [prompt, setPrompt] = useState('');
  const [command, setCommand] = useState('');
  const [selectedActionId, setSelectedActionId] = useState(privilegedActions[0]?.id ?? '');
  const [actionArgsText, setActionArgsText] = useState('{}');
  const [actionDryRun, setActionDryRun] = useState(true);
  const [plusOpen, setPlusOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
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

  const writingMode = mode !== 'Terminal' && mode !== 'Agente';
  const canSubmit =
    !busy &&
    ((writingMode && prompt.trim().length > 0 && !orderDisabledReason) ||
      (mode === 'Terminal' && command.trim().length > 0) ||
      (mode === 'Agente' && activeActionId.length > 0));

  async function handleSend(): Promise<void> {
    setSendError(undefined);
    if (writingMode) {
      await onSendOrder(prompt);
      setPrompt('');
      return;
    }

    if (mode === 'Terminal') {
      await onExecuteCommand(command);
      setCommand('');
      return;
    }

    let args: Record<string, unknown>;
    try {
      if (!activeActionId) {
        setSendError('Escolha uma ação antes de solicitar permissão.');
        return;
      }
      const parsed: unknown = JSON.parse(displayedActionArgsText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setSendError('Os argumentos precisam ser um objeto JSON.');
        return;
      }
      args = parsed as Record<string, unknown>;
    } catch {
      setSendError('JSON inválido. Ajuste o formato antes de enviar.');
      return;
    }
    await onRequestPrivilegedAction(activeActionId, args, actionDryRun);
  }

  async function handleCopyJson(): Promise<void> {
    setSendError(undefined);
    setCopyState('idle');
    try {
      await navigator.clipboard.writeText(displayedActionArgsText);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1400);
    } catch {
      setCopyState('failed');
      setSendError('Não foi possível copiar o JSON.');
    }
  }

  function resizeTextArea(target: HTMLTextAreaElement): void {
    target.style.height = '0px';
    target.style.height = `${Math.min(target.scrollHeight, 132)}px`;
  }

  function chooseMode(nextMode: InputMode): void {
    setMode(nextMode);
    setModeOpen(false);
    if (nextMode === 'Terminal') onOpenTerminal?.();
  }

  const placeholder = mode === 'Código'
    ? 'Descreva o que quer construir, corrigir ou automatizar.'
    : 'Como posso ajudá-lo hoje?';

  return (
    <section className={`command-input-panel prompt-pill-panel mode-${mode.toLowerCase()}`}>
      {sendError ? (
        <div className="input-error-tip prompt-pill-error" role="alert">
          {sendError}
        </div>
      ) : null}

      <div className="prompt-pill">
        <div className="popup-anchor">
          <button
            className="prompt-icon-button prompt-plus-button"
            type="button"
            aria-label="Mais ações"
            onClick={() => setPlusOpen((current) => !current)}
          >
            +
          </button>
          <PopupMenu open={plusOpen} onClose={() => setPlusOpen(false)} align="left">
            <button type="button" onClick={() => { setPlusOpen(false); setSendError('Anexos ainda não estão habilitados nesta build.'); }}>
              Anexar arquivo
            </button>
            <button type="button" onClick={() => { setPlusOpen(false); setSendError('Escolha o projeto pela sidebar ou pelo Controle.'); }}>
              Abrir projeto
            </button>
            <button type="button" onClick={() => { setPlusOpen(false); chooseMode('Terminal'); }}>
              Usar terminal
            </button>
            <button type="button" onClick={() => { setPlusOpen(false); setSendError('Cole o contexto diretamente no campo.'); }}>
              Colar contexto
            </button>
            <button type="button" onClick={() => { setPlusOpen(false); chooseMode('Agente'); }}>
              Comando rápido
            </button>
            <button type="button" onClick={() => { setPlusOpen(false); onOpenModelSelector?.(); }}>
              Abrir Ambiente
            </button>
          </PopupMenu>
        </div>

        {writingMode ? (
          <textarea
            className="prompt-pill-input"
            placeholder={placeholder}
            value={prompt}
            rows={1}
            onInput={(event) => resizeTextArea(event.currentTarget)}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (canSubmit) void handleSend();
              }
            }}
          />
        ) : null}

        {mode === 'Terminal' ? (
          <textarea
            className="prompt-pill-input prompt-pill-terminal"
            placeholder="Comando de terminal"
            value={command}
            rows={1}
            onInput={(event) => resizeTextArea(event.currentTarget)}
            onChange={(event) => setCommand(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (canSubmit) void handleSend();
              }
            }}
          />
        ) : null}

        <div className="prompt-pill-spacer" />

        <div className="popup-anchor">
          <button
            type="button"
            className="prompt-mode-button"
            onClick={() => setModeOpen((current) => !current)}
            aria-label="Selecionar modo de resposta"
          >
            {mode} <span aria-hidden="true">⌄</span>
          </button>
          <PopupMenu open={modeOpen} onClose={() => setModeOpen(false)}>
            {INPUT_MODES.map((item) => (
              <button key={item} type="button" onClick={() => chooseMode(item)}>
                {item}
              </button>
            ))}
          </PopupMenu>
        </div>

        <button
          className="prompt-icon-button"
          type="button"
          aria-label="Entrada por voz"
          onClick={() => setSendError('Entrada por voz ainda não está habilitada nesta build.')}
        >
          ◦
        </button>
        <button
          className="prompt-send-button"
          type="button"
          disabled={!canSubmit}
          title={writingMode ? orderDisabledReason : undefined}
          onClick={() => void handleSend()}
          aria-label="Enviar"
        >
          ➤
        </button>
      </div>

      {mode === 'Agente' ? (
        <div className="prompt-advanced-panel">
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
            <div className="action-spec-card prompt-action-summary">
              <strong>{selectedAction.category}</strong>
              <span>{selectedAction.description}</span>
            </div>
          ) : null}
          <textarea
            className="input-modern args-input"
            value={displayedActionArgsText}
            onChange={(event) => setActionArgsText(event.target.value)}
            rows={4}
          />
          <div className="prompt-advanced-actions">
            <label className="checkbox-modern">
              <input type="checkbox" checked={actionDryRun} onChange={(event) => setActionDryRun(event.target.checked)} />
              Dry-run
            </label>
            <button className="btn-modern" type="button" onClick={() => void handleCopyJson()}>
              {copyState === 'copied' ? 'JSON copiado' : copyState === 'failed' ? 'Falhou' : 'Copiar JSON'}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
