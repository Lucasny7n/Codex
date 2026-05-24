export type RiskLevel = 'Seguro' | 'Médio' | 'Alto' | 'Crítico';

export interface SkillStep {
  order: number;
  description: string;
  command: string;
  args: string[];
  riskLevel: RiskLevel;
  requiresSudo: boolean;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  requiresInternet?: boolean;
  modifiesFiles?: boolean;
  modifiesServices?: boolean;
  backupRequired?: boolean;
  allowedCommands: string[];
  forbiddenCommands?: string[];
  steps: SkillStep[];
  rollback?: string;
  prechecks?: string[];
  postchecks?: string[];
}

export interface ExecutionPlan {
  id: string;
  skillId: string;
  summary: string;
  reason: string;
  totalRisk: RiskLevel;
  requiresSudo: boolean;
  requiresInternet?: boolean;
  modifiesFiles?: boolean;
  modifiesServices?: boolean;
  backupRequired?: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed' | 'cancelled';
  steps: SkillStep[];
  rollbackPlan?: string;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  sourceMessage?: string;
  context?: Record<string, unknown>;
}
