
interface ConsoleProps {
  isOpen: boolean;
  toggle: () => void;
}

export function Console({ isOpen, toggle }: ConsoleProps) {
  return (
    <div className={`console-panel ${isOpen ? 'open' : 'closed'}`}>
      <div className="console-header" onClick={toggle}>
        <span className="console-title">Console & Logs</span>
        <span className="icon-btn" style={{fontSize: '0.75rem'}}>{isOpen ? '▼' : '▲'}</span>
      </div>
      {isOpen && (
        <div className="console-content">
          <div className="log-info">[INFO] Ailu Neural Core inicializado.</div>
          <div className="log-debug">[DEBUG] Procurando instâncias do AirLLM...</div>
          <div className="log-warn">[WARN] Nenhum ambiente AirLLM detectado em ~/.local/share/ailu/airllm-venv</div>
        </div>
      )}
    </div>
  );
}
