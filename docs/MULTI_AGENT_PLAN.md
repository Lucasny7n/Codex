# Multi-Agent Architecture Plan — Codex Squad

## 1. Visão Geral
Transformar o Codex Command Center de um operador mono-agente para uma central de coordenação de um "Squad IA". Cada agente terá um papel (Role) específico, capacidades distintas e memórias compartilhadas.

## 2. Papéis (AgentRoles)
- **Architect:** Focado em design de sistemas, planejamento de alto nível e análise de impacto.
- **Builder (Developer):** Focado em implementação de código, refatoração e resolução de bugs.
- **Reviewer:** Focado em auditoria de segurança, qualidade de código e conformidade com padrões.
- **Tester:** Focado em criação e execução de testes unitários, integração e E2E.
- **Orchestrator:** O agente principal (você) que delega tarefas para os outros sub-agentes.

## 3. Interfaces de Domínio (Proposta)

```typescript
export interface AgentRole {
  id: string;
  name: string;
  description: string;
  icon: string;
  capabilities: string[]; // ex: ['fs_read', 'code_edit', 'test_run']
}

export interface SquadMember {
  id: string;
  role: AgentRole;
  provider: string;
  model: string;
  status: 'idle' | 'busy' | 'offline';
}

export interface TaskDelegation {
  taskId: string;
  assigneeId: string;
  instruction: string;
  dependencies: string[];
}
```

## 4. Integração de Modelos
- **Codex (Local):** Operações rápidas de sistema e arquivos.
- **Gemini CLI:** Pesquisa web profunda e análise de grandes contextos.
- **OpenCode/Aider:** Edição de código guiada por chat.
- **Ollama:** Modelos locais para tarefas privadas ou offline.

## 5. Fluxo de Trabalho do Squad
1. **User** envia ordem para o **Orchestrator**.
2. **Orchestrator** usa o **Architect** para criar um plano.
3. **Orchestrator** delega partes do plano para **Builders**.
4. **Builders** executam e pedem revisão para o **Reviewer**.
5. **Reviewer** aprova ou solicita ajustes.
6. **Tester** valida a entrega final.
7. **Orchestrator** consolida e reporta ao **User**.

## 6. Próximos Passos
- Implementar `ModelSelector` melhorado na UI.
- Criar serviço de `SquadManager` no Rust.
- Adicionar suporte a múltiplos históricos de conversa por sessão (um por sub-agente).
