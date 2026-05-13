# Multi-Agent Plan

Este documento descreve uma direção futura. Nada aqui deve ser apresentado como funcional até existir implementação e validação.

## Objetivo

Preparar o Ailu AI Studio para coordenar perfis especializados de trabalho, mantendo a regra de provider/modelo real e status honesto.

## Possíveis papéis

- Architect: planejamento e análise de impacto.
- Builder: implementação.
- Reviewer: revisão técnica e segurança.
- Tester: validação e cobertura.

## Requisitos antes de implementar

- Provider/profile/modelo validado para cada papel.
- Sessões e histórico separados por papel quando necessário.
- UI clara para mostrar quem executou cada etapa.
- Sem delegação automática para provider indisponível.
- Sem execução de comandos sem permissão explícita.

## Próximos passos possíveis

- Extrair roteamento de agente para serviço dedicado.
- Definir contratos de tarefa e resultado.
- Criar testes para persistência de múltiplos papéis.
- Validar UI com screenshots antes de habilitar o fluxo.
