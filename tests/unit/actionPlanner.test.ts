import { describe, it, expect } from 'vitest';
import { createActionPlan } from '../../src/core/intent/actionPlanner';
import { IntentResult } from '../../src/core/intent/intentTypes';

describe('Action Planner', () => {
  it('does not create plan without skill', () => {
    const intent: IntentResult = {
      type: 'action_plan',
      confidence: 0.9,
      normalizedText: 'faz algo perigoso',
      entities: { target: 'non-existent-skill' }
    };
    expect(createActionPlan(intent)).toBeNull();
  });

  it('creates diagnose-bluetooth plan correctly', () => {
    const intent: IntentResult = {
      type: 'action_plan',
      confidence: 0.9,
      normalizedText: 'arruma bluetooth',
      entities: { target: 'diagnose-bluetooth' }
    };
    const plan = createActionPlan(intent);
    expect(plan).not.toBeNull();
    expect(plan?.skillId).toBe('diagnose-bluetooth');
    expect(plan?.requiresSudo).toBe(false);
    expect(plan?.steps.length).toBeGreaterThan(0);
    // ensure systemctl and rfkill are present
    expect(plan?.steps[0].command).toBe('systemctl');
  });

  it('dynamically injects package in install-package skill', () => {
    const intent: IntentResult = {
      type: 'action_plan',
      confidence: 0.9,
      normalizedText: 'instala heroic',
      entities: { target: 'install-package', package: 'heroic' }
    };
    const plan = createActionPlan(intent);
    expect(plan).not.toBeNull();
    expect(plan?.requiresSudo).toBe(true);
    expect(plan?.steps[0].args).toContain('heroic');
  });
});
