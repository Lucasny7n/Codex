# Módulos do Sistema (Ailu V1)

| Módulo | Responsabilidade | Arquivos Principais | Dependências | Estado | Prioridade | Riscos |
|--------|------------------|---------------------|--------------|--------|------------|--------|
| **Operator UI** | Interface principal, console de chat. | `OperatorPanel.tsx`, `ChatInterface.tsx` | Zustand | Novo | MVP | Baixo |
| **Context Store** | Segura o que o usuário clicou/focou. | `contextStore.ts` | React | Novo | MVP | Baixo |
| **Approval Layer** | Exibe e bloqueia planos de execução. | `ApprovalModal.tsx`, `approval.rs` | Tauri API | Novo | MVP | Alto (Se falhar, roda comandos inseguros) |
| **Executor** | Roda a ação aprovada, captura `stdout`. | `executor/mod.rs` | std::process | Novo | MVP | Médio (Processos zumbis, injeção shell) |
| **Runtime Manager**| Conecta ao Python/AirLLM e Ollama. | `runtime/airllm.rs`, `runtimeStore.ts`| Sidecar Python | Novo | MVP | Alto (Crash de VRAM/RAM) |
| **System Plugins** | Ler e modificar estado do Linux. | `plugins/pacman.rs`, `hyprland.rs` | Comandos CLI Linux | Novo | MVP | Médio (Comandos falharem) |
| **Memória Local** | SQLite para Histórico/Preferências. | `memory/mod.rs`, `memoryStore.ts` | rusqlite | Novo | V2 | Baixo |
| **Voz** | STT/TTS locais sem nuvem. | `voice/mod.rs`, `voiceStore.ts` | piper/whisper | Novo | V3 | Alto (Drivers, ALSA, PipeWire issues) |
