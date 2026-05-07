# CODEX CONTEXT BOOTSTRAP

Base correta:
- usar somente /home/lucas/Codex-Codex
- ignorar /home/lucas/Codex

Conta nova:
- esta conta Plus deve usar o mesmo contexto operacional da conta anterior
- memórias internas do ChatGPT não migram automaticamente entre contas
- o contexto deve vir de AGENTS.md, bootstrap, docs, repo e snapshots locais

Regras principais:
- ler /home/lucas/.codex/AGENTS.md antes de agir
- funcionalidade real antes de visual
- não retornar resposta fake de provider
- cloud sem API/login não pode aparecer como selecionável
- provider sem credencial deve direcionar para API key, login, OAuth ou CLI auth
- local/Ollama precisa diagnosticar, instalar, reparar ou explicar
- erros devem virar mensagem + ação
- Settings precisa ter IA/Providers, modelos locais, execução, permissões, aparência, diagnóstico e avançado
- seletor de IA deve ser limpo, compacto e mostrar apenas modelos compatíveis
- não colocar IA local pesada que não rode bem neste PC sem caveat claro
- corrigir scroll, overflow, visibilidade e cards poluídos
- melhorar suporte a múltiplas contas/profiles por provider quando possível
- sessões devem parecer ChatGPT: só criar após primeira mensagem, nome automático, excluir sessão, exportar mensagens e botão de informações
- botão de informações da sessão deve mostrar data, hora, modelo, provider, mensagens, exportar e excluir
- Health Check deve mostrar provider, Ollama, base correta, permissões, API keys sem revelar segredo e ações recomendadas

Hardware/contexto do sistema:
- Arch Linux
- Fish shell
- Hyprland/Wayland
- AMD Ryzen 5 5500
- RX 7600
- 16 GB RAM
- priorizar modelos locais leves/médios; modelos 32B+ só com aviso forte

Validação obrigatória:
- npm run lint
- npm run typecheck
- npm run test -- --run
- cd src-tauri && cargo check && cargo test

Prompt inicial para nova conta:
Leia /home/lucas/.codex/AGENTS.md e /home/lucas/Codex-Codex/CODEX_CONTEXT_BOOTSTRAP.md antes de qualquer ação. Use somente /home/lucas/Codex-Codex. Ignore /home/lucas/Codex.
