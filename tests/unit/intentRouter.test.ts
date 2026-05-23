import { describe, it, expect } from 'vitest';
import { routeIntent } from '../../src/core/intent/intentRouter';

describe('Intent Router', () => {
  it('detects conversation', () => {
    expect(routeIntent('tudo bem?').type).toBe('conversation');
    expect(routeIntent('oi ailu').type).toBe('conversation');
  });

  it('detects date_time', () => {
    expect(routeIntent('que dia é hoje?').type).toBe('date_time');
    expect(routeIntent('so me diga que dia e hoje').type).toBe('date_time');
  });

  it('detects explanation', () => {
    expect(routeIntent('o que é zram?').type).toBe('explanation');
  });

  it('detects action_plan for bluetooth', () => {
    const result = routeIntent('arruma meu bluetooth');
    expect(result.type).toBe('action_plan');
    expect(result.entities?.target).toBe('diagnose-bluetooth');
  });

  it('detects action_plan for package installation', () => {
    const result = routeIntent('instala heroic');
    expect(result.type).toBe('action_plan');
    expect(result.entities?.target).toBe('install-package');
    expect(result.entities?.package).toBe('heroic');
  });

  it('handles unknown gracefully', () => {
    expect(routeIntent('faz uma salada de frutas').type).toBe('unknown');
  });
});
