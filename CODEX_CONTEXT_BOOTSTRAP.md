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

Rodada atual — UX real, contas, sessões e modelos:
- checkpoint antes da rodada: `bc13f20` com mensagem `checkpoint: pre-ux-sessions-settings-round`
- sessão nova não é persistida no boot nem ao clicar em "Nova conversa"; o arquivo real só nasce no primeiro envio/comando/ação
- título automático vem do conteúdo inicial; backend não injeta resposta fake nem mensagem system fixa na criação
- sessão agora tem ações: renomear, excluir, duplicar, exportar `.md`, exportar `.json` e painel de informações
- export de sessão grava em `~/.codex/sessions/exports/`
- Settings agora cobre: Geral, IA / Providers, Contas / Profiles, Modelos locais, Sessões, Execução, Permissões, Aparência, Diagnóstico e Avançado
- IA / Providers mostra status real, tipo de auth, ação principal, API key mascarada, testar conexão e remover credencial
- Contas / Profiles prepara seleção de profile por provider via `selectedProviderProfileId`, mas o backend ainda mantém uma credencial ativa por provider até keyring/profile store real
- credenciais atuais continuam file-backed e mascaradas na UI; Health Check marca `credentialsEncrypted=false` para deixar keyring como pendência explícita
- seletor de IA mostra profile ativo por provider e filtro "Compatíveis com meu PC"
- compatibilidade local considera Ryzen 5 5500, RX 7600 e 16 GB RAM; 32B/34B entram como não recomendados
- MemoryPanel usa categorias colapsáveis, scroll interno e ações de copiar/exportar snapshot
- layout removeu brilho/orbs e reforçou scroll/overflow em Settings, Memória, Sessions e modal de info

Arquivos centrais da rodada:
- `src/App.tsx`
- `src/components/panels/SessionsPanel.tsx`
- `src/components/panels/SettingsPanel.tsx`
- `src/components/panels/ModelSelector.tsx`
- `src/components/panels/MemoryPanel.tsx`
- `src-tauri/src/services/session_manager.rs`
- `src-tauri/src/commands/mod.rs`
- `src/lib/modelRegistry.ts`
- `src/lib/providerStatus.ts`
- `src/styles/components.css`
- `src/styles/layout.css`

Pendências reais:
- keyring/plataforma segura ainda não substituiu o fallback `credentials.json`
- múltiplas credenciais reais por provider ainda precisam de store dedicada; UI já prepara profile/default sem misturar segredo
- login/OAuth externos não são executados automaticamente; status direciona para ação correta
- modelos locais dependem de Ollama instalado, API `127.0.0.1:11434`, disco, rede e modelo presente em `ollama list`

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
