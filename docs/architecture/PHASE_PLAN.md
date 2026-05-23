# Plano de Fases (Fases Estritas)

Cada fase deve compilar isoladamente e rodar os testes.

## Fase 1 - Core Shell
- Remover cosméticos do React.
- Subir a UI com o Tema Dark, Sidebar colapsável e Chat Multilinha.
- *Meta de Compilação:* `npm run dev` abre e exibe chat sem mock pesado.

## Fase 2 & 3 - Contexto e Runtime
- Implementar Zustand Global de Contexto.
- Criar a camada Rust que detecta o ambiente Python para o AI Runtime.
- *Meta de Compilação:* Rust consegue invocar um script python vazio em background e ler retorno.

## Fase 4, 5, 6 - Catálogo de Modelos e Downloads
- Implementar lista de modelos (Qwen, DeepSeek).
- Lógica Rust para baixar pesados (fila, progresso, lib `reqwest`).
- Checagem de GPU/RAM.
- *Meta de Compilação:* O app consegue calcular a viabilidade de um modelo e enfileirar o download de um dummy file.

## Fase 7 & 8 - Segurança (Approval & Executor)
- A *alma* do app. Implementar o modal estrito que impede qualquer bash run.
- O Executor Rust (sem `sh -c`).
- *Meta de Compilação:* App pede aprovação de `echo "oi" > teste.txt` antes de executar.

## Fases Finais (9 a 20)
- Criação e integração dos arquivos JSON de skills (Pacman, Git, etc).
- SQLite para Memória e Diagnósticos.
- Voice pipeline (STT/TTS).
- Escrita de testes e UX Review final.
