import { expect, test, type Page } from '@playwright/test';

const screenshotDir = 'test-results/screenshots';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      transformCallback: (callback: unknown) => number;
      unregisterCallback: () => undefined;
      convertFileSrc: (path: string) => string;
      metadata: { currentWindow: { label: string }; currentWebview: { label: string } };
      plugins: { path: { sep: string; delimiter: string } };
      invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
    };
  }
}

function nowIso(): string {
  return new Date('2026-05-09T12:00:00.000Z').toISOString();
}

async function installTauriMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const now = '2026-05-09T12:00:00.000Z';
    const session = {
      id: 'visual-session-1',
      title: 'Passada visual',
      createdAt: now,
      updatedAt: now,
      status: 'idle',
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'Validar visual da home',
          createdAt: now,
          attachments: [
            {
              path: '/tmp/visual.md',
              name: 'visual.md',
              kind: 'text',
              size: 1200,
              previewAvailable: true,
            },
          ],
        },
      ],
      tasks: [],
    };
    const settings = {
      workspaceRoot: '/tmp/workspace',
      codexRoot: '/tmp/.codex',
      selectedProviderId: 'mock-development',
      selectedModelId: 'mock-development-model',
      selectedAgentId: 'equilibrado',
      selectedProviderProfileId: 'mock-development:default',
      preferredShell: '/usr/bin/bash',
      autoApproveSafeRead: true,
      executionMode: 'cloud',
      modelSelectionHistory: [],
      localModelsRoot: '/tmp/.codex/models',
      themePreference: new URL(window.location.href).searchParams.get('theme') === 'light' ? 'light' : 'dark',
      aiResponseLanguage: 'pt-BR',
      autoGenerateTitles: true,
      autoCopyResponses: false,
      pasteLargeTextAsFile: true,
      personalization: {
        memoriesStored: true,
        referenceChatHistory: true,
        customizeCodexQwen: false,
        manageCookies: false,
        webPageExtraction: false,
        imageSearch: false,
        webSearch: true,
        imageGeneration: false,
        codeInterpreter: true,
        recoverHistoricalMemories: true,
        imageEditing: false,
        memoryUpdate: true,
        localImageUpscaling: false,
      },
    };
    const provider = {
      id: 'mock-development',
      label: 'Mock Provider',
      configurable: true,
      enabled: true,
      status: { state: 'ready', message: 'Mock pronto para screenshot.', checkedAt: now },
      models: [{ id: 'mock-development-model', label: 'Mock', providerId: 'mock-development', supportsTools: false }],
    };
    const localRuntime = {
      state: 'ready',
      message: 'Ollama pronto',
      modelsDir: '/tmp/.codex/models',
      installedModels: [{ id: 'qwen2.5-coder:1.5b' }],
      installed: true,
      serviceActive: true,
      apiReachable: true,
      apiUrl: 'http://127.0.0.1:11434',
      canUsePacman: true,
      hasPkexec: true,
      hasSudo: true,
      diskOk: true,
      problems: [],
      repairActions: [],
      at: now,
    };

    window.__TAURI_INTERNALS__ = {
      transformCallback: (callback: unknown) => {
        const id = Math.floor(Math.random() * 1_000_000);
        (window as unknown as Record<string, unknown>)[`_${id}`] = callback;
        return id;
      },
      unregisterCallback: () => undefined,
      convertFileSrc: (path: string) => path,
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
      plugins: { path: { sep: '/', delimiter: ':' } },
      invoke: async (cmd: string, args?: Record<string, unknown>) => {
        if (cmd === 'bootstrap_state') {
          return {
            settings,
            workspaceMeta: { root: '/tmp/workspace', repoName: 'Codex-Codex', branch: 'main', headShort: 'abc1234', dirty: false },
            sessions: [session],
            pendingPermissions: [],
            providers: [provider],
            providerProfiles: [],
            agentProfiles: [{ id: 'equilibrado', label: 'Equilibrado', description: 'Diagnóstico sólido.', mode: 'equilibrado' }],
            memory: { profileSummary: 'Resumo', userPreferences: [], activeProjects: [], importantFixHistory: [], operationalPolicies: [] },
            theme: { source: 'visual', accentPrimary: '#2d95ec', accentSecondary: '#8cc8ff', background: '#08080d' },
          };
        }
        if (cmd === 'list_provider_credentials') return [];
        if (cmd === 'list_provider_profiles') return [];
        if (cmd === 'list_privileged_actions') return [];
        if (cmd === 'get_local_runtime_state') return localRuntime;
        if (cmd === 'plugin:event|listen') return 1;
        if (cmd === 'plugin:event|unlisten') return undefined;
        if (cmd === 'update_settings') return args?.settings;
        if (cmd === 'export_all_conversations') return { path: '/tmp/codex-conversas.json', format: 'json', bytes: 100 };
        if (cmd === 'archive_all_sessions') return [];
        if (cmd === 'delete_all_sessions') return 1;
        return undefined;
      },
    };
  });
}

async function openApp(page: Page, theme: 'dark' | 'light' = 'dark'): Promise<void> {
  await installTauriMock(page);
  await page.goto(`/?theme=${theme}`);
  await expect(page.getByPlaceholder('Como posso ajudá-lo hoje?')).toBeVisible();
}

async function screenshot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(180);
  await page.screenshot({ path: `${screenshotDir}/${name}.png`, fullPage: true });
}

test('captura fluxos visuais principais', async ({ page }) => {
  await openApp(page, 'dark');
  await screenshot(page, 'home-dark');

  await page.getByTitle(/mock-development-model/).click();
  await expect(page.locator('.model-picker-title')).toHaveText('Modelos');
  await screenshot(page, 'topbar-model-selector');

  await page.keyboard.press('Escape');
  await page.getByLabel('Selecionar modo de resposta').click();
  await expect(page.getByText('Pensamento')).toBeVisible();
  await screenshot(page, 'menu-modos');

  await page.keyboard.press('Escape');
  await page.getByLabel(/Iniciar Bate-papo Temporário/).click();
  await expect(page.getByRole('heading', { name: 'Bate-papo Temporário' })).toBeVisible();
  await screenshot(page, 'temporary-chat');

  await page.getByLabel('Recolher sidebar').click();
  await expect(page.getByLabel('Abrir sidebar')).toBeVisible();
  await screenshot(page, 'sidebar-colapsada');
});

test('captura tema claro e configurações', async ({ page }) => {
  await openApp(page, 'light');
  await screenshot(page, 'home-light');

  await page.getByLabel('Menu do usuário').click();
  await page.getByText('Configurações').click();
  await expect(page.getByRole('dialog', { name: 'Configurações' })).toBeVisible();
  await screenshot(page, 'settings-geral-light');

  await page.getByRole('button', { name: 'Modelos' }).click();
  await expect(page.getByText('Informações dos modelos')).toBeVisible();
  await screenshot(page, 'settings-modelos-light');
});

test('mantém data fixa para evitar ruído de screenshots', () => {
  expect(nowIso()).toBe('2026-05-09T12:00:00.000Z');
});
