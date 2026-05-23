export interface ExecutionStep {
  order: number;
  description: string;
  command: string;
  args: string[];
  riskLevel: 'Seguro' | 'Baixo' | 'Médio' | 'Alto' | 'Crítico';
  requiresSudo: boolean;
  rollbackCommand?: string;
}

export interface ExecutionPlan {
  id: string;
  summary: string;
  reason: string;
  steps: ExecutionStep[];
  totalRisk: string;
  requiresSudo: boolean;
  backupRequired: boolean;
  rollbackPlan?: string;
  skillId?: string;
}
