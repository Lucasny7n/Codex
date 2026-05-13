# Modelo de Permissões

## Categorias

- `safe_read`
- `workspace_write`
- `external_write`
- `network`
- `privileged`
- `package_install`
- `critical_system`

## Fluxo

1. Usuário solicita comando comum ou ação privilegiada.
2. Backend classifica risco/categoria.
3. Se sensível, app abre `Permission Request` com:
- título e descrição;
- ação/comando planejado;
- categoria;
- risco (`low`, `medium`, `high`, `critical`);
- alvo;
- rollback (quando aplicável).
4. Usuário aprova (`Sim`) ou nega (`Não`).
5. Resultado vira `permission-outcome` com status:
- `success`
- `failed`
- `denied`
- `blocked`

## Garantias de segurança

- Aprovação é política da aplicação e não coleta senha.
- App nunca usa `sudo -S` e nunca armazena senha.
- `pkexec` é usado apenas para helper dedicado com action policy própria.
- Não existe shell root arbitrário no protocolo de helper.
- Ações desconhecidas ou argumentos inválidos são bloqueados.
- Serviço fora da allowlist é bloqueado.
- Saída e status ficam auditáveis em:
  - feed de status da sessão;
  - `~/.codex/ailu-ai-studio/logs/privileged-actions.log`.

## Por que não `sudo -S` e não `NOPASSWD: ALL`

- `sudo -S` exige fluxo de senha por stdin, aumentando risco de vazamento/acoplamento da credencial.
- `NOPASSWD: ALL` remove o princípio do menor privilégio e vira root arbitrário para qualquer comando.
- O modelo adotado usa:
  - ação explícita (`action_id`);
  - validação forte de argumentos;
  - allowlist técnica;
  - aprovação explícita no app;
  - auditoria por log.

## Política para comandos diretos

- `pkexec` e `doas` diretos no campo de comando comum são bloqueados.
- `sudo` só é aceito em modo não interativo (`sudo -n`).
- Se `sudo -n` não estiver disponível no host, execução é bloqueada com mensagem explícita.

## Ações de maior risco

As seguintes ações exigem confirmação alta:
- `pacman_install_packages`
- `bootctl_set_default_kernel`
- `restore_file`

Além disso:
- alterações em `/boot` geram backup automático;
- restauração de arquivo gera backup prévio do destino quando existente.

## Allowlist de serviços (ações systemctl_*)

No estado atual, as ações `systemctl_enable_service`, `systemctl_disable_service`,
`systemctl_restart_service` e `systemctl_status_service` aceitam unidades `.service` e `.timer`,
mas só dentro da allowlist:

- `waydroid-container.service`
- `fstrim.timer`
- `NetworkManager.service`
- `NetworkManager-wait-online.service`
- `cliphist.service`
- `cliphist-text.service`
- `cliphist-image.service`
- `com.system76.Scheduler.service`
- `polkit.service`
