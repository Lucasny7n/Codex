# Modelo de Segurança

## Regras de Execução

1. **Sem Sudo Direto:**
   O processo principal NUNCA rodará como root. Comandos que requerem `sudo` só podem ser passados ao usuário como instrução, ou utilizar `polkit`/`pkexec` de forma rastreável com alerta **Crítico**. `sudo -S` é estritamente proibido.

2. **Interceptação por Approval:**
   Nenhum arquivo do usuário é editado, baixado ou apagado sem um `ExecutionPlan` prévio exibido pelo React. O usuário **precisa** clicar em "Aprovar". 

3. **White-listing (Skills):**
   A IA só pode executar binários listados nas "Skills". Ex: A skill `install-package.json` só autoriza a palavra binária inicial `pacman`, `yay` ou `flatpak`.
   Injeção de shell (`sh -c`) é proibida para ações que derivam de outputs da IA.

4. **Rollback Nativo:**
   Toda edição de arquivo cria um `arquivo.bak`. Todo download guarda o checksum temporário.

5. **Dados Sensíveis:**
   Arquivos em `~/.ssh` e `/etc` são categorizados como Paths Críticos e disparam avisos vermelhos na Approval Layer. Nenhuma Key é lida e mandada pra cloud (tudo roda localmente nos modelos ou no LLM open source selecionado).
