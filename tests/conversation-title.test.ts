import { describe, expect, it } from 'vitest';
import { containsOffensive, sanitizeTitle, titleFromContent } from '../src/lib/chat/conversationTitle';

describe('titleFromContent', () => {
  it('resume saudação simples em vez de copiar', () => {
    expect(titleFromContent('fala amigo')).toBe('Saudação em português');
    expect(titleFromContent('oi')).toBe('Saudação em português');
  });

  it('mensagem ofensiva curta vira título neutro, sem copiar o palavrão', () => {
    const title = titleFromContent('fala comigo cuzao');
    expect(title).toBe('Teste de linguagem informal');
    expect(title.toLowerCase()).not.toContain('cuzao');
  });

  it('mensagem ofensiva LONGA também vira título neutro (bug crítico)', () => {
    const offensive = 'cara você é um idiota completo e não serve pra nada mesmo seu merda';
    const title = titleFromContent(offensive);
    expect(title).toBe('Teste de linguagem informal');
    expect(containsOffensive(title)).toBe(false);
  });

  it('detecta ofensa em inglês e não copia', () => {
    const title = titleFromContent('this app is fucking broken you piece of shit');
    expect(title).toBe('Teste de linguagem informal');
    expect(title.toLowerCase()).not.toMatch(/fuck|shit/);
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

  it('detecta relato de problema', () => {
    expect(titleFromContent('o app travou e não funciona mais')).toBe('Relato de problema');
  });
});

describe('sanitizeTitle (título vindo da IA)', () => {
  it('rejeita título ofensivo gerado pela IA', () => {
    expect(sanitizeTitle('Idiota que não sabe nada')).toBe('Teste de linguagem informal');
    expect(sanitizeTitle('"fuck this"')).toBe('Teste de linguagem informal');
  });

  it('limpa aspas/pontuação e capitaliza', () => {
    expect(sanitizeTitle('"plano de migração."')).toBe('Plano de migração');
  });

  it('encurta título longo a no máximo ~7 palavras', () => {
    const out = sanitizeTitle('um título muito comprido com muitas palavras demais para a sidebar caber');
    expect(out?.endsWith('…')).toBe(true);
  });

  it('retorna undefined para vazio', () => {
    expect(sanitizeTitle('   ')).toBeUndefined();
  });
});
