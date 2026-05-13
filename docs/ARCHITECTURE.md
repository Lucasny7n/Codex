# Arquitetura

Ailu AI Studio é um app desktop Tauri v2 com frontend React/TypeScript e backend Rust. A arquitetura privilegia status honesto: provider, conta, modelo ou runtime só podem aparecer como prontos depois de validação real.

## Camadas

### Frontend

- `src/app/App.tsx`: composição principal, bootstrap, seleção de sessão, chat normal, chat temporário e abertura de modais/drawers.
- `src/components/layout/`: shell, topbar e abas de inspector.
- `src/components/chat/`: transcript, composer, STT no fluxo do microfone e conversas arquivadas.
- `src/components/settings/`: configurações, health check, modelos locais, conversas e personalização.
- `src/components/models/`: tipos e superfícies do seletor de ambiente/modelo.
- `src/components/file/`: browser de arquivos e formatação visual de anexos.
- `src/components/common/`: modal, menu, toast, badges, ícones e controles compartilhados.
- `src/lib/api/`: chamadas Tauri e listeners de eventos.
- `src/lib/models/`: registry, opções do seletor, comparação e presets.
- `src/lib/ollama/`: normalização, busca e candidatos de download para modelos Ollama.
- `src/lib/providers/`: regras de status, seleção e ações por provider/modelo.
- `src/lib/file/`, `src/lib/memory/`, `src/lib/theme/`, `src/lib/utils/`: serviços de frontend por domínio.
- `src/types/domain.ts`: contratos TypeScript compartilhados.

### Backend

- `src-tauri/src/commands/`: comandos Tauri. Deve atuar como ponte fina entre frontend e serviços.
- `src-tauri/src/models/`: contratos Rust serializáveis.
- `src-tauri/src/services/session_manager.rs`: persistência, arquivamento, exportação e importação de sessões.
- `src-tauri/src/services/provider_adapters.rs`: adapters reais de providers cloud e local.
- `src-tauri/src/services/provider_registry.rs`: catálogo runtime de providers e profiles.
- `src-tauri/src/services/credential_store.rs`: credenciais mascaradas, profiles e último status testado.
- `src-tauri/src/services/local_runtime.rs`: diagnóstico, download, remoção e teste de modelos Ollama.
- `src-tauri/src/services/permission_manager.rs`: risco, aprovação e resolução de permissões.
- `src-tauri/src/services/command_executor.rs`: execução controlada e logs de comandos.

`src-tauri/src/commands/mod.rs` ainda concentra muitas pontes Tauri e é candidato a divisão por domínio. Essa separação deve ser feita em PR próprio para reduzir risco.

## Fluxo de chat normal

1. Frontend garante uma sessão persistente ativa quando a primeira mensagem é enviada.
2. `send_order_to_agent` recebe sessão, conteúdo, modo e anexos estruturados.
3. Backend persiste a mensagem do usuário no `SessionManager`.
4. O roteador monta o prompt com sessão, anexos e configuração de ambiente.
5. `ProviderRegistry` escolhe adapter/profile/modelo já validados.
6. O adapter retorna resposta real ou erro classificado.
7. Backend persiste a resposta e retorna a sessão atualizada.

## Fluxo de bate-papo temporário

1. Frontend cria sessão efêmera em memória.
2. `send_temporary_order_to_agent` recebe mensagens temporárias, conteúdo e anexos.
3. Backend usa o mesmo `ProviderRegistry` e os mesmos adapters reais do chat normal.
4. A resposta volta como sessão efêmera.
5. Nada é salvo no histórico, nos arquivos de sessão ou em conversas arquivadas.

## Fluxo de modelo local Ollama

1. Frontend consulta `get_local_runtime_state`.
2. Backend valida binário, serviço, API `127.0.0.1:11434`, modelos instalados e erros recentes.
3. A busca local normaliza o nome digitado e cria candidato para baixar quando o modelo não está instalado.
4. `install_local_model` executa download com progresso real.
5. Depois do download, o app recarrega o snapshot e só libera uso se o modelo aparecer e passar no teste.

## Fluxo de modelo cloud

1. Provider declara método de autenticação e modelos suportados.
2. UI coleta API key/profile ou direciona para login/CLI quando aplicável.
3. `test_provider_connection` executa validação real.
4. `CredentialStore` persiste credencial mascarada e último status.
5. Apenas provider/profile/modelo `ready` fica selecionável.

## Fluxo de anexos

1. Usuário seleciona arquivos pelo browser local.
2. Backend retorna metadados e preview limitado quando seguro.
3. Composer mostra chips e não despeja conteúdo no textarea.
4. Envio inclui anexos como contexto estruturado para o provider.

## Fluxo de STT

1. Composer solicita permissão de microfone pelo WebView.
2. Frontend grava áudio quando `navigator.mediaDevices` está disponível.
3. Backend valida `ffmpeg`, backend Whisper/Vosk e modelo configurado.
4. Transcrição retorna texto ou erro acionável, sem fingir captura ou backend.

## Princípios

- Sem falso `ready`.
- Sem provider ou modelo simulado em produção.
- Sem `sudo` silencioso.
- Sem segredo em log, screenshot, commit ou mensagem de erro.
- Erro técnico deve virar mensagem curta com ação clara; detalhes ficam em área técnica.
- Refatoração estrutural deve preservar imports, testes e comportamento.
