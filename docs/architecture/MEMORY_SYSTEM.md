# Sistema de Memória Local

O Ailu implementa memória passiva de longo prazo guardando contextos no SQLite local. Isso permite que a IA "lembre" de correções anteriores de hardware, preferência de ferramentas (ex: "sempre uso YAY no Arch"), e problemas crônicos.

## Banco de Dados SQLite
Gerenciado pelo Rust (`rusqlite`) no path configurado (`~/.local/share/ailu/data/memory.db`).

## Categorias de Memória
- **preference**: "Sempre use tema escuro", "Nunca altere .bashrc sem perguntar"
- **hardware**: Dados extraídos de falhas no PipeWire, ou drivers Nvidia bloqueados
- **success**: Comandos e rotinas que funcionaram numa dada sessão para resolver problemas
- **error**: Erros crônicos da máquina ou do usuário ("Wifi cai após suspender")

## O "Modo Aprendiz"
Sempre que a resposta de uma IA for corrigida pelo usuário ("não é assim, eu quero que faça daquela forma"), a UI perguntará: *Quer que eu salve isso na memória?* 
Isso irá disparar um comando Rust para atualizar o SQLite. A Memória é puxada pro System Prompt de inicialização nas sessões futuras.
