# AI HANDOFF GEMINI — Codex Command Center

Base obrigatória: `/home/lucas/Codex-Codex`.

Ignore `/home/lucas/Codex`. Não copie arquivos da base antiga.

## Rodada Entregue

- V31: Home foi refeita no blueprint Qwen3-style: sidebar 250-270px, main vazia, top selector no canto superior esquerdo, título central "Pronto para criar algo?" e input pill horizontal.
- V31: Removidos da superfície principal: hero antigo, input/card gigante, quick actions grandes, atalhos técnicos, inspector lateral e terminal/logs abertos.
- V31: Sidebar agora é `QwenSidebar` visual em `SessionsPanel`: logo discreto, Nova Conversa, busca, Comunidade, Coder, Projetos/Lucas, sessões com `⋮`, export submenu e rodapé Lucas.
- V31: `CommandInputPanel` virou `PromptPill`: botão `+` com menu, modos Pensamento/Rápido/Código/Terminal/Agente, Enter envia, Shift+Enter quebra linha e terminal só abre por intenção explícita.
- V31: `TopBar` foi reduzida para selector de modelo + um botão de Controle; branch, repo, provider badges e status técnico saíram da home.
- V31: `Ambiente` continua sendo fluxo único para Prontos, Configurar, Contas, Locais e Diagnóstico; Settings/Controle apenas encaminha IA/Contas/Local para o Ambiente.
- V31: Erros cloud agora separam `invalid_api_key` (401), `forbidden` (403), `quota_exceeded` (429 quota), `rate_limited` (429 temporário) e `provider_unavailable` (5xx).
- V31: `ProviderErrorCard` no chat mostra erro compacto com ações de trocar conta/modelo e detalhes técnicos em accordion; backend sanitiza segredo e evita JSON cru na mensagem.
- V31: `provider_message_from_http` deixou de anexar corpo bruto do provider no chat; mensagens incluem título curto, ação clara, status, provider e modelo.
- V31: `ConfigManager` normaliza settings persistidas para `codexRoot = ~/.codex` e troca workspace legado `/home/lucas/Codex` por `/home/lucas/Codex-Codex` quando existir.
- V31: Validação executada: `npm run typecheck`, `npm run test -- --run`, `npm run lint`, `cargo check`, `cargo fmt`, `cargo test` e `git diff --check`.
- V20: `Ambiente` virou a entrada única para modelo, API key, login web, contas/profiles, modelos locais e diagnóstico.
- V20: Topbar e input abrem o mesmo modal `Ambiente`; Settings/Controle só encaminha para Ambiente em IA, Contas e Modelos locais.
- V20: Aba `Prontos` mostra apenas modelos `ready`; providers/profile/local não prontos ficam em `Configurar`, `Contas` ou `Locais`.
- V20: Modelos prontos têm `Usar neste chat`, confirmação para `Aplicar para todos os chats` e `Definir padrão global`.
- V20: Sessões agora persistem override de ambiente (`providerId`, `modelId`, `agentProfileId`, `accountProfileId`) e `send_order_to_agent` respeita esse override.
- V20: API key é configurada no modal Ambiente com input mascarado, teste real e remoção via menu da conta; segredo completo não aparece na UI.
- V20: Login web abre URLs reais via `@tauri-apps/plugin-shell` e só muda para `ready` após verificação/teste real.
- V20: Home segue blueprint limpo: sem inspector, sem painel direito, sem terminal/logs expostos e sem cards técnicos.
- V20: Sidebar ficou ainda mais discreta; tarefas/memória viraram atalhos para o modal Controle, e sessões expõem só `⋮`.
- V20: Tokens End4 foram ajustados para fundo `#0a0a0f`, glass escuro, radius 16/24px e z-index escalonado.
- V20: Modelos locais 32B/34B são filtrados das listas compatíveis/prontas para Ryzen 5 5500, RX 7600 e 16 GB RAM.
- V23: `PremiumModal` e `PopupMenu` agora renderizam em portal/layer; modal interno de API/confirmação fica acima do Ambiente, ESC fecha o nível correto e menu não é cortado por overflow.
- V23: API key tem fluxo `Salvar`, `Testar conexão` e `Salvar e testar`; key salva sem teste continua `testing`, e teste real persiste `last_status` do profile.
- V23: `ProviderGenerateRequest` leva `accountProfileId`; OpenAI/OpenRouter/Anthropic/Gemini usam a credencial do profile escolhido em vez de cair no default por acidente.
- V23: Confirmação de `Aplicar para todos` virou modal com `Somente novas mensagens`, `Aplicar a todas sessões` e `Cancelar`.
- V23: Topbar ficou discreta (`Ambiente` + controle) e o input foi separado em `Ambiente` e `Modelo`; a home não mostra aviso técnico de provider bloqueado.
- V17: Home foi simplificada para estilo Qwen Coder/End4: título curto, subtítulo curto, input central amplo, quick actions pequenas e mais espaço negativo.
- V17: Sidebar ficou minimalista: logo, Nova conversa, busca, sessões com `⋮`, status discreto e usuário no rodapé; ações secundárias saíram da superfície.
- V17: Menu de sessão `⋮` abre popup escuro; exportação mostra submenu de formato e salva direto via backend em `~/Downloads/Sessoes`.
- V17: Inspector lateral foi removido da superfície principal; `Controle` abre modal central amplo com `Configurações` por padrão.
- V17: Topbar usa Environment selector limpo com provider/profile/modelo ativo, sem chips técnicos extras.
- V17: Login web agora usa `@tauri-apps/plugin-shell` (`open(provider.setupUrl)`) e permissão `shell:allow-open`; o comando backend `open_external_url`/`xdg-open` foi removido.
- V17: Providers em Settings têm uma ação primária visível e ações secundárias em `⋮`; detalhes técnicos ficam em accordion.
- V13: Controle/Settings foi movido para modal central amplo; a aba inicial é `Configurações`.
- V13: Abas do modal: Configurações, IA, Contas, Modelos locais, Terminal, Sessões, Aprovações, Arquivos, Status, Prompt, Tarefas, Memória, Diagnóstico e Avançado.
- V13: API key usa modal de credencial com senha mascarada, toggle de visibilidade, validação curta, `save_credential`, `test_provider_connection` e erro curto sem stack.
- V13: Environment selector mostra somente modelos realmente prontos: cloud exige provider/profile `ready`; local exige Ollama `ready` e modelo instalado.
- V13: Sessões usam menu `⋮`; exportação aceita `.md`, `.json` e `.txt` em `~/Downloads/Sessoes` com nome sanitizado e timestamp em conflito.
- V13: `window.alert`, `window.prompt`, `window.confirm` e `catch {}` vazio foram removidos de `src`/`src-tauri`.
- V13: Tokens End4/Qwen aplicados em `src/styles/tokens.css`; componentes comuns em `src/components/common/PremiumUI.tsx`.
- V13: Terminal/sudo seguem por CommandInputPanel, CommandExecutor e PermissionManager; Settings > Terminal explicita shell, stdout/stderr, sudo bloqueado e pkexec/helper.
- Sessões não são mais criadas no boot ou no clique em "Nova conversa".
- A primeira mensagem/comando/ação cria a sessão persistida com título automático.
- Sessões têm renomear, excluir, duplicar, exportar `.md`, exportar `.json`, exportar `.txt` e modal de informações.
- Exportações vão para `~/Downloads/Sessoes/`.
- Settings foi reorganizada em 10 abas: Geral, IA / Providers, Contas / Profiles, Modelos locais, Sessões, Execução, Permissões, Aparência, Diagnóstico e Avançado.
- Providers mostram status real, tipo de auth, API key mascarada, ação correta e teste de conexão.
- Contas / Profiles prepara `selectedProviderProfileId`, mas o backend ainda guarda uma credencial ativa por provider.
- Seletor de IA ganhou filtros compactos, profile ativo e compatibilidade local.
- Modelos 32B/34B ficam como não recomendados para Ryzen 5 5500, RX 7600 e 16 GB RAM.
- MemoryPanel ganhou categorias colapsáveis, scroll interno, copiar contexto e exportar snapshot.
- Health Check exibe base, providers, profiles, Ollama, storage, sessões e estado de credenciais sem revelar segredo.
- V9 adicionou multi-profile real no backend: `CredentialStore` persiste vários profiles por provider, default isolado e IDs únicos.
- Bootstrap e frontend agora recebem `providerProfiles`; seletor e Settings mostram a conta/profile ativa.
- Cloud só seleciona se provider estiver `ready` e profile aplicável também estiver pronto.
- Codex CLI foi registrado como provider, mas fica `requires_cli_auth`/`unavailable` e não executa sem adapter validado.
- Settings ganhou `Terminal & Permissões`, política sudo/pkexec, stdout/stderr e diagnóstico copiável sem secrets.
- Home sem sessão foi limpa/premium; quick actions só criam sessão quando acionadas.
- Fallback para `/home/lucas/Codex` foi removido do default de workspace.
- MemoryPanel agora reporta erro de clipboard; Settings no Inspector usa navegação compacta para evitar cards esmagados.

## Arquivos Alterados Principais

- `src/App.tsx`
- `src/types/domain.ts`
- `src/lib/api.ts`
- `src/components/common/PremiumUI.tsx`
- `src/components/panels/SessionsPanel.tsx`
- `src/components/panels/SettingsPanel.tsx`
- `src/components/panels/ModelSelector.tsx`
- `src/components/layout/TopBar.tsx`
- `src-tauri/src/services/session_manager.rs`
- `src-tauri/src/services/credential_store.rs`
- `src-tauri/src/services/provider_adapters.rs`
- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/models.rs`
- `src-tauri/capabilities/default.json`
- `src/styles/components.css`
- `src/styles/layout.css`
- `src/styles/tokens.css`
- `package.json`
- `src-tauri/Cargo.toml`
- `tests/model-selector.test.tsx`
- `tests/settings-panel.test.tsx`
- `tests/sessions-panel.test.tsx`
- `tests/command-input-panel.test.tsx`

## Como Testar

```bash
cd /home/lucas/Codex-Codex
npm run lint
npm run typecheck
npm run test
cd src-tauri
cargo fmt
cargo check
cargo test
```

Validação V31 executada em 2026-05-07:
- `npm run lint`: passou sem avisos.
- `npm run typecheck`: passou.
- `npm run test -- --run`: 12 arquivos, 36 testes passaram.
- `cd src-tauri && cargo fmt`: aplicado.
- `cd src-tauri && cargo check`: passou.
- `cd src-tauri && cargo test`: 36 testes passaram.
- `git diff --check`: passou.
- `npm run tauri dev`: subiu Vite em 5173, compilou Tauri e abriu `target/debug/codex_command_center`.
- Captura visual 1920x1080 no Hyprland com janela Tauri fullscreen: home limpa com sidebar fina, selector no topo, título central e prompt pill; sem inspector/painel direito/logs/cards técnicos.

Teste visual/manual:

```bash
cd /home/lucas/Codex-Codex
npm run tauri dev
```

Verificar:

- abrir app sem criar sessão nova no storage;
- enviar primeira mensagem e conferir título automático;
- exportar sessão em `.md`, `.json` e `.txt` para `~/Downloads/Sessoes`;
- excluir sessão ativa e voltar para "Nova conversa";
- abrir Controle > IA e confirmar API key/login/teste sem sucesso falso;
- abrir Controle > Contas e confirmar profile/default isolado;
- abrir Ambiente e confirmar que provider sem key/login, provider `testing` e local sem runtime/modelo instalado não aparecem em Prontos;
- adicionar API key, usar `Salvar` para manter `testing`, depois `Salvar e testar`/`Testar conexão` para virar `ready`;
- selecionar um profile e enviar mensagem; o backend deve usar o `accountProfileId` da sessão;
- abrir Ambiente > Locais e confirmar que 32B/34B não aparecem como modelos compatíveis/prontos;
- abrir MemoryPanel e conferir scroll/accordion.

## Pendências Reais

- Keyring ainda não está integrado; `credentials.json` é fallback file-backed, mascarado na UI.
- Multi-conta real por provider já existe no store local, mas ainda precisa migração futura para keyring por profile id.
- OAuth/login externo não foi automatizado; UI direciona para ação/status correto.
- Codex CLI aparece como provider, mas o adapter operacional segue bloqueado até validação real de auth/runtime.
- Terminal real existe via CommandInputPanel, request_execution, CommandExecutor e PermissionManager; loop autônomo provider -> tool call -> terminal ainda precisa desenho/implementação.
- Ollama/local depende de runtime, serviço/API, rede para pull e modelo instalado.
- Validação visual manual completa depende de executar `npm run tauri dev` em sessão gráfica real.
- Nenhum provider deve gerar resposta fake em falta de key/login/runtime.

## Prompts Curtos Para Revisão Gemini

UI:
```text
Revise home, TopBar, Settings, SessionsPanel e ModelSelector/Ambiente em /home/lucas/Codex-Codex. Foque em blueprint End4/Qwen ultra-clean, zero sobreposição, scroll, overflow, texto cortado, hierarquia e densidade. Não proponha branding externo.
```

Sessões:
```text
Revise o fluxo de sessões. Confirme que não há sessão persistida no boot, que a primeira mensagem cria título automático e que rename/delete/export/info funcionam sem perder sessão ativa.
```

Providers:
```text
Revise ProviderAdapterRegistry, CredentialStore, Settings e ModelSelector/Ambiente. Confirme que nenhum provider/profile sem API key/login/CLI auth aparece como pronto ou selecionável.
```

Login web:
```text
Revise SettingsPanel, src/lib/api.ts, package.json, src-tauri/Cargo.toml, src-tauri/src/lib.rs e capabilities/default.json. Confirme que login web usa @tauri-apps/plugin-shell, abre URLs reais registradas e não volta para xdg-open nem simula OAuth.
```

Popups/export:
```text
Revise SessionsPanel, PremiumUI e session_manager. Confirme menu de sessão por ⋮, submenu Markdown/JSON/TXT, export em ~/Downloads/Sessoes, nome sanitizado e timestamp sem sobrescrever.
```

Profiles:
```text
Revise o store de provider profiles. Confirme que múltiplas contas por provider não sobrescrevem credenciais, que default é por provider e que nenhum segredo completo aparece em UI/log/teste/export.
```

Local/Ollama:
```text
Revise localRuntime, ModelSelector e modelRegistry. Confirme compatibilidade para Ryzen 5 5500, RX 7600 e 16 GB RAM; 32B+ não pode aparecer como escolha tranquila.
```

Terminal/sudo:
```text
Revise request_execution, CommandExecutor, PermissionManager e Settings > Terminal & Permissões. Confirme stdout/stderr real, aprovação para risco, bloqueio de sudo interativo e erro acionável.
```

Segurança:
```text
Revise CredentialStore e Health Check. Confirme que segredo completo não aparece em UI/log/export/teste e que a pendência de keyring está explícita.
```
