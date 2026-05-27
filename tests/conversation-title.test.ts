import { describe, expect, it } from 'vitest';
import { titleFromContent } from '../src/lib/chat/conversationTitle';

describe('titleFromContent', () => {
  it('resume saudação simples em vez de copiar', () => {
    expect(titleFromContent('fala amigo')).toBe('Saudação em português');
    expect(titleFromContent('oi')).toBe('Saudação em português');
  });

  it('resume tom informal/vulgar pela intenção, sem copiar o palavrão', () => {
    const title = titleFromContent('fala comigo cuzao');
    expect(title).toBe('Teste de tom informal');
    expect(title.toLowerCase()).not.toContain('cuzao');
  });

  it('detecta pedido de atualização do sistema', () => {
    expect(titleFromContent('pode rodar um update do sistema?')).toBe('Atualização do sistema');
  });

  it('detecta pergunta sobre hardware', () => {
    expect(titleFromContent('qual é o meu hardware e a GPU?')).toBe('Diagnóstico de hardware');
  });

  it('detecta pergunta sobre modelos locais', () => {
    expect(titleFromContent('quais modelos locais e MoE consigo rodar?')).toBe('Modelos locais');
  });

  it('detecta pergunta de memória do usuário', () => {
    expect(titleFromContent('o que você tem salvo sobre mim?')).toBe('Memória do usuário');
  });

  it('encurta prompt técnico longo sem copiar tudo', () => {
    const long = 'Preciso reorganizar a estrutura de pastas do meu repositório e padronizar os nomes dos arquivos seguindo uma convenção consistente';
    const title = titleFromContent(long);
    expect(title.length).toBeLessThanOrEqual(49);
    expect(title.endsWith('…')).toBe(true);
  });

  it('remove ruído de markdown e usa a primeira linha útil', () => {
    expect(titleFromContent('```ts\nconst x = 1;\n```\n# Plano de migração')).toBe('Plano de migração');
  });

  it('cai para rótulo de data quando não há conteúdo', () => {
    expect(titleFromContent('   \n  ')).toContain('Conversa');
  });
});
