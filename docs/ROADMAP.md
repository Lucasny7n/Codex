# Roadmap

Roadmap curto e honesto. Itens aqui não devem ser apresentados como implementados.

## Próximos passos

- Reduzir `src/app/App.tsx` em hooks e módulos de fluxo testáveis.
- Dividir `src-tauri/src/commands/mod.rs` por domínio mantendo commands como ponte fina.
- Integrar keyring nativo para credenciais por profile.
- Melhorar diagnóstico guiado para Ollama offline, porta ocupada e modelo ausente.
- Endurecer STT com seleção explícita de backend/modelo e teste local.
- Ampliar cobertura visual de chat temporário, seletor e Settings.
- Preparar adapters adicionais apenas quando houver autenticação e teste reais.

## Fora de escopo nesta versão

- Geração de imagem.
- Instalação silenciosa de runtimes ou modelos.
- Provider marcado como pronto sem teste.
- Execução root arbitrária.
- Runtimes locais além de Ollama como fonte ativa.
