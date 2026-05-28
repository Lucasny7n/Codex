import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectAppearancePicker } from '../src/components/common/ProjectAppearancePicker';
import {
  DEFAULT_PROJECT_COLOR,
  DEFAULT_PROJECT_ICON,
  PROJECT_COLOR_CHOICES,
} from '../src/components/common/projectAppearanceOptions';

describe('ProjectAppearancePicker', () => {
  it('não renderiza quando fechado', () => {
    const { container } = render(
      <ProjectAppearancePicker
        open={false}
        icon={DEFAULT_PROJECT_ICON}
        color={DEFAULT_PROJECT_COLOR}
        onClose={() => {}}
        onSelectIcon={() => {}}
        onSelectColor={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('seleciona ícone e cor via callbacks', () => {
    const onSelectIcon = vi.fn();
    const onSelectColor = vi.fn();
    render(
      <ProjectAppearancePicker
        open
        icon={DEFAULT_PROJECT_ICON}
        color={DEFAULT_PROJECT_COLOR}
        onClose={() => {}}
        onSelectIcon={onSelectIcon}
        onSelectColor={onSelectColor}
      />,
    );

    fireEvent.click(screen.getByLabelText('Ícone fileCode'));
    expect(onSelectIcon).toHaveBeenCalledWith('fileCode');

    const targetColor = PROJECT_COLOR_CHOICES[1];
    fireEvent.click(screen.getByLabelText(`Cor ${targetColor}`));
    expect(onSelectColor).toHaveBeenCalledWith(targetColor);
  });

  it('marca o ícone e a cor ativos com aria-pressed', () => {
    render(
      <ProjectAppearancePicker
        open
        icon="cpu"
        color={PROJECT_COLOR_CHOICES[2]}
        onClose={() => {}}
        onSelectIcon={() => {}}
        onSelectColor={() => {}}
      />,
    );
    expect(screen.getByLabelText('Ícone cpu')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(`Cor ${PROJECT_COLOR_CHOICES[2]}`)).toHaveAttribute('aria-pressed', 'true');
  });
});
