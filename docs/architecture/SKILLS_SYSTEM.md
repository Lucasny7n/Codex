# Sistema de Skills (Trilhos de Ação)

Skills são a única maneira do Ailu V1 modificar o estado da máquina Linux do usuário, impedindo que o LLM invente bash maliciosos ou destrutivos em texto livre.

## Formato (JSON)
Cada Skill reside em `src/skills/` e determina o contrato do que pode ou não ser feito.

Exemplo: `install-package.json`
```json
{
  "id": "install-package",
  "name": "Instalar Pacotes",
  "allowedCommands": ["pacman", "yay", "flatpak"],
  "forbiddenCommands": ["rm", "dd", "chmod", "sh", "bash"],
  "requiredPermissions": ["installPackages"],
  "riskLevel": "Alto",
  "steps": [
    "1. Busca do pacote local",
    "2. Confirmação do nome real",
    "3. Execução do comando de install com bypass interativo (-S --noconfirm)"
  ]
}
```

## Validação no Rust
O Tauri não expõe `shell::Command` generico para a interface React de forma livre.
Em vez disso, a interface pede `execute_skill(plan_id)`.
O Rust recupera o plano de execução, verifica na tabela de `Skills` se a whitelist de binários corresponde com `args[0]` e executa de modo empacotado.
