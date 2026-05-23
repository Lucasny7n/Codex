# Plano de Testes (Ailu V1)

A integridade estrutural e de segurança do Ailu V1 será garantida por baterias de testes em todos os níveis, provendo blindagem contra execuções nocivas.

## 1. Testes Unitários e Integração (Rust)
Rodados via `cargo test --manifest-path src-tauri/Cargo.toml`.
- **Parsing e Segurança:** Verificar se a camada do Executor realmente barra comandos proibidos (ex: injetar `; rm -rf /` nos argumentos).
- **SQLite Database:** Operações de CRUD na memória local sem locks indesejados.
- **Hardware Diagnostics:** Regexes do parsing de CPU e lshw.

## 2. Testes de Unidade UI (Vitest)
Rodados via `npm run test`.
- **Hooks e Zustand:** Testar `ContextStore` selecionando items simulados.
- **Renderização Condicional:** Garantir que o `ApprovalModal` renderiza os itens em vermelho quando `requiresSudo` ou risco Crítico estiverem ativos.

## 3. Testes E2E (Playwright)
Rodados via Chromium/Webkit, garantindo o ciclo vital.
- O App "Abre".
- "O que é Zram" gera chamada ao mock local e exibe na tela.
- "Arruma meu bluetooth" obrigatoriamente trava no modal.
- Copiar comandos via botão no modal funciona no clipboard.

## 4. Testes Manuais Finais
Em ambiente físico nativo, sem contêiner estrito:
- Rodar AirLLM via Sidecar gerando carga na GPU.
- Microfone e Áudio emitindo corretamente eventos no log.
