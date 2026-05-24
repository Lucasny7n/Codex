import { IntentResult } from './intentTypes';
import { ExecutionPlan } from '../skills/skillTypes';
import { skillRegistry } from '../skills/skillRegistry';

export function createActionPlan(intent: IntentResult): ExecutionPlan | null {
  if (intent.type !== 'action_plan' || !intent.entities?.target) {
    return null;
  }

  const skillId = intent.entities.target;
  const skill = skillRegistry.get(skillId);

  if (!skill) {
    return null; // Will trigger the "Não encontrei uma skill segura..." error
  }

  let steps = [...skill.steps];
  let summary = skill.name;
  let requiresSudo = skill.steps.some(s => s.requiresSudo);

  // Handle dynamic package installation
  if (skillId === 'install-package' && intent.entities.package) {
    summary = `Instalar Pacote: ${intent.entities.package}`;
    steps = [
      { 
        order: 1, 
        description: `Sincronizar base e instalar ${intent.entities.package}`, 
        command: 'sudo', 
        args: ['pacman', '-Syu', intent.entities.package, '--noconfirm'], 
        riskLevel: 'Médio', 
        requiresSudo: true 
      }
    ];
    requiresSudo = true;
  }

  return {
    id: `plan-${skillId}-${Date.now()}`,
    skillId: skill.id,
    summary,
    reason: intent.reason || skill.description,
    totalRisk: skill.riskLevel,
    requiresSudo,
    requiresInternet: skill.requiresInternet,
    modifiesFiles: skill.modifiesFiles,
    modifiesServices: skill.modifiesServices,
    backupRequired: skill.backupRequired,
    status: 'pending',
    steps,
    createdAt: new Date().toISOString()
  };
}
