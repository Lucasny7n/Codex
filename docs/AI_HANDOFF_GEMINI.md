# AI HANDOFF GEMINI — Codex Command Center

Base obrigatória: `/home/lucas/Codex-Codex`.

Ignore `/home/lucas/Codex`. Não copie arquivos da base antiga.

## Rodada Entregue

- Sessões não são mais criadas no boot ou no clique em "Nova conversa".
- A primeira mensagem/comando/ação cria a sessão persistida com título automático.
- Sessões têm renomear, excluir, duplicar, exportar `.md`, exportar `.json` e modal de informações.
- Exportações vão para `~/.codex/sessions/exports/`.
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
- `src/stores/appStore.ts`
- `src/types/domain.ts`
- `src/lib/api.ts`
- `src/lib/modelRegistry.ts`
- `src/lib/providerStatus.ts`
- `src/components/panels/SessionsPanel.tsx`
- `src/components/panels/SettingsPanel.tsx`
- `src/components/panels/ModelSelector.tsx`
- `src/components/panels/MemoryPanel.tsx`
- `src/components/panels/ChatPanel.tsx`
- `src-tauri/src/services/credential_store.rs`
- `src-tauri/src/services/provider_adapters.rs`
- `src-tauri/src/services/session_manager.rs`
- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/models.rs`
- `src/styles/components.css`
- `src/styles/layout.css`

## Como Testar

```bash
cd /home/lucas/Codex-Codex
npm run lint
npm run typecheck
npm run test -- --run
cd src-tauri
cargo fmt
cargo check
cargo test
```

Teste visual/manual:

```bash
cd /home/lucas/Codex-Codex
npm run tauri dev
```

Verificar:

- abrir app sem criar sessão nova no storage;
- enviar primeira mensagem e conferir título automático;
- exportar sessão em `.md` e `.json`;
- excluir sessão ativa e voltar para "Nova conversa";
- abrir Settings > IA / Providers e confirmar que provider sem key não fica selecionável;
- abrir Settings > Contas / Profiles e confirmar profile/default;
- abrir seletor de IA > Local > Compatíveis com meu PC e confirmar que 32B/34B somem;
- abrir MemoryPanel e conferir scroll/accordion.

## Pendências Reais

- Keyring ainda não está integrado; `credentials.json` é fallback file-backed, mascarado na UI.
- Multi-conta real por provider já existe no store local, mas ainda precisa migração futura para keyring por profile id.
- OAuth/login externo não foi automatizado; UI direciona para ação/status correto.
- Codex CLI aparece como provider, mas o adapter operacional segue bloqueado até validação real de auth/runtime.
- Terminal real existe via CommandInputPanel, request_execution, CommandExecutor e PermissionManager; loop autônomo provider -> tool call -> terminal ainda precisa desenho/implementação.
- Ollama/local depende de runtime, serviço/API, rede para pull e modelo instalado.
- Nenhum provider deve gerar resposta fake em falta de key/login/runtime.

## Prompts Curtos Para Revisão Gemini

UI:
```text
Revise home, TopBar, Settings, MemoryPanel, SessionsPanel e ModelSelector em /home/lucas/Codex-Codex. Foque em visual premium limpo, scroll, overflow, texto cortado, hierarquia e densidade. Não proponha branding externo.
```

Sessões:
```text
Revise o fluxo de sessões. Confirme que não há sessão persistida no boot, que a primeira mensagem cria título automático e que rename/delete/export/info funcionam sem perder sessão ativa.
```

Providers:
```text
Revise ProviderAdapterRegistry, CredentialStore, Settings e ModelSelector. Confirme que nenhum provider/profile sem API key/login/CLI auth aparece como pronto ou selecionável.
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
