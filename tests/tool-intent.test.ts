import { describe, expect, it } from 'vitest';
import { detectToolIntent } from '../src/lib/tools/intent';

describe('detectToolIntent', () => {
  it('routes hardware questions to get_hardware_summary', () => {
    expect(detectToolIntent('qual meu hardware?')).toBe('get_hardware_summary');
    expect(detectToolIntent('mostra minha GPU e VRAM')).toBe('get_hardware_summary');
  });

  it('routes local model questions to list_local_models', () => {
    expect(detectToolIntent('quais modelos locais eu tenho?')).toBe('list_local_models');
    expect(detectToolIntent('liste meus modelos do ollama')).toBe('list_local_models');
  });

  it('routes diagnostics to get_health_status', () => {
    expect(detectToolIntent('o que está errado no meu sistema?')).toBe('get_health_status');
    expect(detectToolIntent('faz um diagnóstico')).toBe('get_health_status');
  });

  it('routes update requests to request_system_update', () => {
    expect(detectToolIntent('rode um update')).toBe('request_system_update');
    expect(detectToolIntent('atualize o sistema')).toBe('request_system_update');
  });

  it('routes process questions to list_running_processes', () => {
    expect(detectToolIntent('quais processos estão rodando no meu PC?')).toBe('list_running_processes');
    expect(detectToolIntent('mostra os processos')).toBe('list_running_processes');
    expect(detectToolIntent('o que está consumindo memória no sistema?')).toBe('list_running_processes');
  });

  it('returns undefined for normal chat', () => {
    expect(detectToolIntent('me explique como funciona o tauri')).toBeUndefined();
    expect(detectToolIntent('escreva um poema')).toBeUndefined();
  });
});
