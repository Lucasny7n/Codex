import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ModelSelector } from '../src/components/panels/ModelSelector';
import { localCompatibility, modelRegistry } from '../src/lib/modelRegistry';

describe('ModelSelector legado', () => {
  it('não renderiza a tela global antiga de modelos', () => {
    render(<ModelSelector open />);

    expect(screen.queryByText('Prontos')).not.toBeInTheDocument();
    expect(screen.queryByText('Contas')).not.toBeInTheDocument();
    expect(screen.queryByText('Diagnóstico')).not.toBeInTheDocument();
  });
});

describe('modelRegistry', () => {
  it('mantém catálogo amplo de nuvem pesquisável por modelo e provedor', () => {
    expect(modelRegistry.search('cloud', 'OpenAI').some((model) => model.displayName === 'GPT-5.5')).toBe(true);
    expect(modelRegistry.search('cloud', 'Groq').some((model) => model.displayName === 'Llama via Groq')).toBe(true);
    expect(modelRegistry.search('cloud', 'Cerebras').some((model) => model.displayName === 'Llama via Cerebras')).toBe(true);
    expect(modelRegistry.search('cloud', 'Perplexity').some((model) => model.displayName === 'Sonar')).toBe(true);
  });

  it('mantém catálogo local amplo com famílias e modelos pesados', () => {
    expect(modelRegistry.search('local', 'Qwen3 8B').some((model) => model.id === 'qwen3:8b')).toBe(true);
    expect(modelRegistry.search('local', 'StarCoder').some((model) => model.displayName === 'StarCoder2 15B')).toBe(true);

    const heavy = modelRegistry.byId('qwen3:32b');
    expect(heavy).toBeTruthy();
    expect(localCompatibility(heavy!)).toBe('not_recommended');
  });

  it('não aceita modelo sem status e setupRequirement', () => {
    for (const model of modelRegistry.all()) {
      expect(model.baseStatus).toBeTruthy();
      expect(model.setupRequirement).toBeTruthy();
      expect(model.actionLabel).toBeTruthy();
      expect(model.modalities.length).toBeGreaterThan(0);
    }
  });
});
