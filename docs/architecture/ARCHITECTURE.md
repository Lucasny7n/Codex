# Arquitetura do Ailu AI Studio (Assistente Operacional Local)

## 1. Visão Geral
O Ailu foi reconstruído do zero para funcionar como um assistente local para o ecossistema Linux (Arch, Hyprland, Wayland). Ele se divide em três camadas principais:
1. **Frontend:** React + TypeScript + Vite, focado puramente em interação, sem lógicas de sistema.
2. **Backend/Core:** Tauri + Rust, lidando com chamadas ao OS de forma segura (system calls, execução, filas de modelos, memórias).
3. **Sidecar Python:** Um processo isolado gerenciado pelo Rust, focado apenas em ML (AirLLM/Torch).

## 2. Diagrama de Fluxo

```mermaid
flowchart TD
    U[Usuário (Chat / Voz)] --> C[React UI]
    C -->|IPC Context| T[Tauri/Rust Core]
    
    T -->|Criação do Plano| P[Execution Plan Builder]
    P -->|Avaliação de Risco| A[Approval Layer Modal]
    
    A -->|Se Aprovado| E[Rust Executor]
    E -->|Roda Comando / OS| OS[Arch Linux / Hyprland]
    
    A -->|Se Cancelado| R[Cancelado (Sem efeitos)]
    E -->|Gera Erro ou Sucesso| L[Logger & Memory (SQLite)]
    
    T <-->|Gerencia| PY[Sidecar Python (AirLLM)]
    PY <-->|Inferencia LLM| LLM[(Local Models)]
```

## 3. Componentes Centrais
- **Camada React:** Controla a interface, chat e janelas nativas. Exibe componentes como "Operator", "Approval Modal".
- **Camada Rust/Tauri:** A "cola" de segurança do sistema. Nada passa para o OS sem aprovação.
- **Sidecar Python:** Roda num `venv` local `~/.local/share/ailu/airllm-venv`. Roda LLMs com e sem offload.
- **AI Runtime Manager:** Detecta AirLLM, Ollama, llama.cpp. Controla início e fim dos processos.
- **Model Manager:** Interface unificada para listagem, download e troca de IAs.
- **Download Manager:** Implementação Rust para downloads (fila, progresso real) seguro, checando disco.
- **Voice Engine:** Interface com STT/TTS (faster-whisper / piper) que alimenta a interface.
- **Memory Engine:** SQLite via Rust para salvar contexto e preferência (modo aprendiz).
- **Command Executor & Approval Layer:** Executa os bash scripts e APIs do sistema protegidos pela `skills_whitelist`.
- **System Plugins:** Conjuntos predefinidos de comandos (pacman.rs, git.rs, hyprland.rs).
- **Logs & Segurança:** Tudo tem log com níveis de risco. Nenhuma API key em texto plano. Sem root (`sudo`) direto.
