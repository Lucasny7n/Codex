interface BasePromptPanelProps {
  content: string;
  saving: boolean;
  onChange: (next: string) => void;
  onSave: () => Promise<void>;
}

export function BasePromptPanel({
  content,
  saving,
  onChange,
  onSave
}: BasePromptPanelProps): JSX.Element {
  return (
    <section className="panel base-prompt-panel">
      <header className="panel-header">
        <h2>Prompt Base do Agente</h2>
      </header>
      <div className="panel-body form-stack">
        <textarea rows={8} value={content} onChange={(event) => onChange(event.target.value)} />
        <button
          type="button"
          className="btn-modern btn-modern-primary"
          disabled={saving}
          onClick={async () => onSave()}
        >
          Salvar prompt base
        </button>
      </div>
    </section>
  );
}
