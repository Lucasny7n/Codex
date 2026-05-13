import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OnboardingPanel } from '../src/components/panels/OnboardingPanel';

describe('OnboardingPanel', () => {
  it('renderiza passos e ações principais', () => {
    render(
      <OnboardingPanel
        onOpenGuide={vi.fn()}
        onOpenQuickstart={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onOpenDataRoot={vi.fn()}
        onOpenLogs={vi.fn()}
        onRunCheckEnvironment={vi.fn()}
      />,
    );

    expect(screen.getByText('Primeiros Passos')).toBeInTheDocument();
    expect(screen.getByText('Abrir Guia de Uso')).toBeInTheDocument();
    expect(screen.getByText('Abrir Quickstart')).toBeInTheDocument();
    expect(screen.getByText('Rodar check-environment')).toBeInTheDocument();
  });
});
