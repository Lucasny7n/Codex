function envFlag(name: string, fallback: boolean): boolean {
  const value = import.meta.env[name];
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

export const featureFlags = {
  aiPanelEnabled: envFlag('VITE_AILU_AI_PANEL_ENABLED', true),
  llmLibraryEnabled: envFlag('VITE_AILU_LLM_LIBRARY_ENABLED', true),
  desktopAppEnabled: envFlag('VITE_AILU_DESKTOP_APP_ENABLED', true),
  terminalEnabled: envFlag('VITE_AILU_TERMINAL_ENABLED', true),
  webPreviewEnabled: envFlag('VITE_AILU_WEB_PREVIEW_ENABLED', true),
  experimentalAgentTools: envFlag('VITE_AILU_EXPERIMENTAL_AGENT_TOOLS', false),
} as const;

export type FeatureFlagName = keyof typeof featureFlags;
