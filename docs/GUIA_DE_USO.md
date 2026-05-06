# Guia de Uso: Codex Command Center

Os comandos abaixo assumem terminal aberto na raiz do projeto. Se mudar de terminal, rode `export WORKSPACE_ROOT="$(pwd)"` novamente.

## 1. O que é
O Codex Command Center é um app desktop para operar agentes tipo Codex no Linux, com execução controlada, permissões explícitas, logs, integração com VS Code e memórias em `~/.codex`.

## 2. Para que serve
- Enviar tarefas para o agente.
- Rodar comandos com política de permissão.
- Aprovar ou negar ações sensíveis.
- Usar um helper privilegiado com allowlist para ações root.
- Acompanhar status, tarefas, logs e arquivos alterados.
- Abrir projeto, arquivos e docs no VS Code.

## 3. Como abrir em desenvolvimento
```bash
export WORKSPACE_ROOT="$(pwd)"
npm run tauri dev
```

## 4. Como gerar build/pacote
```bash
export WORKSPACE_ROOT="$(pwd)"
npm run tauri build -- --debug
```

Os pacotes debug ficam em:
- `src-tauri/target/debug/bundle/deb/`
- `src-tauri/target/debug/bundle/rpm/`

## 5. Como abrir no VS Code
```bash
code "$WORKSPACE_ROOT"
```

Também existe o botão `Abrir projeto no VS Code` no topo do app.

## 6. Tela principal
O app é dividido em painéis de trabalho. O fluxo normal é: escolher modelo/agente, enviar tarefa, acompanhar status, aprovar permissões quando necessário e abrir arquivos no VS Code.

## 7. Painéis

### Sessões
- Lista sessões salvas.
- Troca o contexto do trabalho atual.

### Conversa/Agente
- Mostra mensagens entre você e o agente.
- Exibe resumo de raciocínio quando disponível.

### Tarefas
- Mostra etapas em `pending`, `running`, `done` ou `error`.

### Status
- Mostra o que o app/agente está fazendo, com justificativas e erros resumidos.

### Terminal/Logs
- Exibe `stdout`, `stderr` e eventos de execução.

### Permissões Pendentes
- Mostra categoria, risco, alvo, comando planejado e reversão.
- `Sim` executa.
- `Não` cancela.

### Arquivos Alterados
- Mostra arquivos tocados.
- Abre o arquivo no VS Code.

### Configurações
- Seleciona provider, modelo, perfil/agente, shell e autoaprovação de leitura segura.

### Memórias
- Mostra contexto carregado de `~/.codex`.

### Prompt Base
- Permite ler e editar `~/.codex/AGENTS.md`.

### Primeiros Passos
- Mostra um tour rápido.
- Abre docs, logs, `~/.codex`, VS Code e roda `check-environment`.

## 8. Escolher modelo/provider
No painel `Modelos e Agentes`, selecione `Provider` e depois `Modelo`.

## 9. Escolher agente/perfil
No painel `Modelos e Agentes`, selecione `Perfil do Agente`: `rapido`, `equilibrado`, `profundo`, `agressivo` ou `seguro`.

## 10. Enviar uma ordem
Na seção `Ordem e Execução`, digite a tarefa em `Ordem para o agente` e clique em `Enviar ordem`.

## 11. Acompanhar execução
- Use `Tarefas` para ver etapa atual.
- Use `Status e Justificativas` para entender decisões.
- Use `Terminal e Logs` para saída detalhada.

## 12. Aprovar permissões
No painel `Permissões Pendentes`, leia risco, alvo e reversão antes de clicar em `Sim`. Clique em `Não` para cancelar.

## 13. Dry-run
`dry-run` simula a ação sem aplicar alteração real. Use antes de ações críticas, comandos novos ou qualquer operação que toque sistema, pacotes ou boot.

## 14. Testar ação privilegiada
Use esta ação como primeiro teste:

- Ação: `systemctl_status_service`
- JSON:

```json
{"service":"waydroid-container.service"}
```

Marque `dry-run`, solicite a ação e aprove no painel de permissões.

## 15. Instalar helper
Instale apenas quando entender o modelo de permissão.

```bash
cd "$WORKSPACE_ROOT/src-tauri"
cargo build --release --bin codex-privileged-helper

cd "$WORKSPACE_ROOT"
bash scripts/install-privileged-helper.sh
```

## 16. Remover helper
```bash
cd "$WORKSPACE_ROOT"
bash scripts/uninstall-privileged-helper.sh
```

## 17. Ver logs
- App: `~/.codex/codex-ui/logs/privileged-actions.log`
- Helper root: `/var/log/codex-privileged-helper.log`
- Fallback do helper: `/tmp/codex-privileged-helper.log`

## 18. Reverter alterações
- Backups do app ficam em `~/.codex/codex-ui/backups/`.
- Scripts de instalação/remoção criam rollback.
- Ações de restauração fazem backup do destino antes de sobrescrever.

## 19. Cuidados
- Não digite senha no app.
- Não libere root total sem entender o impacto.
- Não aprove ação crítica sem ler risco, alvo e reversão.
- Não instale o helper se não entender permissões/polkit.

## 20. Exemplos práticos

### Ver status do Waydroid
- Ação: `systemctl_status_service`
- JSON:

```json
{"service":"waydroid-container.service"}
```

### Iniciar Waydroid
- Ação: `waydroid_start`
- JSON:

```json
{}
```

### Parar Waydroid
- Ação: `waydroid_stop`
- JSON:

```json
{}
```

### Habilitar fstrim
- Ação: `systemctl_enable_service`
- JSON:

```json
{"service":"fstrim.timer"}
```

### Definir kernel padrão
- Ação: `bootctl_set_default_kernel`
- JSON:

```json
{"entry":"arch-linux-cachyos-bore.conf"}
```
