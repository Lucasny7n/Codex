# AI Handoff

Documento curto para revisão posterior por outra ferramenta. Não substitui README, docs técnicos ou testes.

## Escopo atual

- App desktop Tauri v2 com React, TypeScript e Rust.
- Local usa Ollama real.
- Cloud usa providers/adapters reais e exige autenticação testada.
- Chat temporário usa o mesmo pipeline real e não persiste sessão.
- Credenciais não devem aparecer completas em UI, log, screenshot ou commit.

## Áreas críticas para revisão

- `src/app/App.tsx`: orquestração principal e oportunidade de extração gradual.
- `src/components/chat/`: composer, STT, transcript e arquivadas.
- `src/components/layout/TopBar.tsx`: separação `Nuvem | Local` e estados de modelo.
- `src/components/settings/SettingsPanel.tsx`: health check, modelos locais e conversas.
- `src/lib/models/`, `src/lib/ollama/`, `src/lib/providers/`: regras de modelo/status.
- `src-tauri/src/commands/mod.rs`: ponte Tauri ainda grande.
- `src-tauri/src/services/provider_adapters.rs`: providers cloud/local e erros classificados.
- `src-tauri/src/services/local_runtime.rs`: Ollama, download, remoção e teste.
- `src-tauri/src/services/credential_store.rs`: profiles e credenciais mascaradas.

## Checklist de revisão

- Nenhum provider/profile sem autenticação testada aparece como pronto.
- Modelo local não instalado aparece como candidato para baixar, não como selecionável.
- Chat temporário não cria sessão nem grava histórico.
- STT diferencia permissão, captura, backend ausente e modelo ausente.
- API keys ficam mascaradas e fora de logs.
- Commands Rust chamam serviços em vez de concentrar regra nova.
- UI preserva separação clara entre local e nuvem.
