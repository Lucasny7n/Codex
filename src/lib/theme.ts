import type { SystemTheme, ThemePreference } from '../types/domain';

export type ResolvedTheme = 'light' | 'dark';

function systemPrefersLight(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: light)').matches
    : false;
}

export function resolveThemePreference(preference: ThemePreference = 'dark'): ResolvedTheme {
  if (preference === 'system') {
    return systemPrefersLight() ? 'light' : 'dark';
  }
  return preference;
}

export function applyAppTheme(accent: Pick<SystemTheme, 'accentPrimary' | 'accentSecondary' | 'background'>, preference: ThemePreference = 'dark'): ResolvedTheme {
  const root = document.documentElement;
  const resolved = resolveThemePreference(preference);

  root.dataset.themePreference = preference;
  root.dataset.theme = resolved;
  root.style.setProperty('--accent', accent.accentPrimary);
  root.style.setProperty('--accent-2', accent.accentSecondary);
  root.style.setProperty('--accent-strong', accent.accentSecondary);
  root.style.setProperty('--end4-background', resolved === 'dark' ? accent.background : '#f6f8fc');

  return resolved;
}
