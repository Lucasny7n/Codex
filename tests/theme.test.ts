import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyAppTheme, resolveThemePreference } from '../src/lib/theme';

const accent = {
  accentPrimary: '#2d95ec',
  accentSecondary: '#9dcaff',
  background: '#000000',
};

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-theme-preference');
  vi.restoreAllMocks();
});

describe('theme preferences', () => {
  it('resolveThemePreference respeita claro, escuro e sistema', () => {
    expect(resolveThemePreference('light')).toBe('light');
    expect(resolveThemePreference('dark')).toBe('dark');

    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    expect(resolveThemePreference('system')).toBe('dark');
  });

  it('troca para tema claro e persiste a preferência no atributo do root', () => {
    applyAppTheme(accent, 'light');

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.dataset.themePreference).toBe('light');
  });

  it('troca para tema escuro', () => {
    applyAppTheme(accent, 'dark');

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.themePreference).toBe('dark');
  });

  it('Sistema usa prefers-color-scheme sem salvar claro/escuro fixo', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    applyAppTheme(accent, 'system');

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.dataset.themePreference).toBe('system');
  });
});
