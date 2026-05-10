import { expect, test, type Page } from '@playwright/test';

const screenshotDir = '/home/lucas/Lucas-Workspace/Temp';

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
    window.localStorage.setItem('codex-sidebar-conversations-open', 'true');
    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: () => Promise.reject(new DOMException('Nenhum microfone no mock visual.', 'NotFoundError')),
      },
    });
    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: class MockMediaRecorder {
        static isTypeSupported(): boolean {
          return true;
        }
      },
    });
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: undefined });
    Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, value: undefined });

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
          content: 'Valide markdown, anexos e uma mensagem longa sem a scrollbar invadir o conteúdo.',
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
        {
          id: 'm2',
          role: 'assistant',
          content: '### Resultado\n\n- Markdown limpo\n- Ações discretas\n- Scrollbar fora da bolha\n\n`const status = "ok"`\n\n' + 'Mensagem longa '.repeat(90),
          createdAt: now,
          reasoningSummary: 'Pensamento concluído com validação visual.',
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

    const longAttachmentName = 'relatorio-final-com-nome-muito-longo-para-validar-chip-premium.md';
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
        if (cmd === 'get_stt_config_state') {
          return {
            ffmpeg: { id: 'ffmpeg', label: 'ffmpeg', installed: true, ready: true, message: 'ffmpeg disponível.' },
            backends: [
              { id: 'whisper-cli', label: 'whisper-cli', installed: false, ready: false, message: 'Requer whisper-cli e modelo local.' },
            ],
            modelExists: false,
            modelCandidates: [],
            ready: false,
            installCommand: 'sudo pacman -S --needed ffmpeg whisper.cpp',
            message: 'Nenhum backend STT local encontrado.',
            checkedAt: now,
          };
        }
        if (cmd === 'send_temporary_order_to_agent') {
          return {
            id: 'temporary-chat',
            title: 'Bate-papo Temporário',
            createdAt: now,
            updatedAt: now,
            status: 'idle',
            tasks: [],
            messages: [
              ...(args?.messages as unknown[] ?? []),
              { id: 'temp-user', role: 'user', content: args?.content, createdAt: now },
              { id: 'temp-assistant', role: 'assistant', content: 'Resposta temporária real do provider.', createdAt: now },
            ],
          };
        }
        if (cmd === 'plugin:event|listen') return 1;
        if (cmd === 'plugin:event|unlisten') return undefined;
        if (cmd === 'update_settings') return args?.settings;
        if (cmd === 'export_all_conversations') return { path: '/tmp/codex-conversas.json', format: 'json', bytes: 100 };
        if (cmd === 'archive_all_sessions') return [];
        if (cmd === 'delete_all_sessions') return 1;
        if (cmd === 'list_file_directory') {
          return {
            path: '/tmp',
            parentPath: '/',
            shortcuts: [],
            entries: [
              {
                name: longAttachmentName,
                path: `/tmp/${longAttachmentName}`,
                kind: 'text',
                extension: 'md',
                isDirectory: false,
                size: 34567,
                modifiedAt: now,
              },
            ],
            truncated: false,
          };
        }
        if (cmd === 'get_file_attachment') {
          return {
            name: longAttachmentName,
            path: `/tmp/${longAttachmentName}`,
            kind: 'text',
            extension: 'md',
            isDirectory: false,
            size: 34567,
            modifiedAt: now,
            preview: 'Conteúdo de texto usado apenas no payload.',
            previewKind: 'text',
            previewTruncated: false,
          };
        }
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

test('captura home, composer, anexos, chat temporário e seletor em tema escuro', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openApp(page, 'dark');
  await screenshot(page, 'pass-13-home-dark');
  await screenshot(page, 'pass-13-composer-disabled');

  const input = page.getByPlaceholder('Como posso ajudá-lo hoje?');
  await input.focus();
  await screenshot(page, 'pass-13-composer-focus-dark');
  await input.fill('Validar envio ativo');
  await screenshot(page, 'pass-13-composer-enabled');

  await page.getByTitle(/mock-development-model/).click();
  await expect(page.locator('.model-picker-title')).toHaveText('Modelos');
  await screenshot(page, 'pass-13-model-selector-cloud');
  await page.getByLabel('Buscar modelo ou provedor').fill('GPT-5.5');
  await page.getByTestId('model-row-gpt-5.5').hover();
  await screenshot(page, 'pass-13-model-selector-hover');
  await page.getByRole('tab', { name: 'Local' }).click();
  await page.getByLabel('Buscar modelo ou provedor').fill('Qwen');
  await screenshot(page, 'pass-13-model-selector-local');
  await page.keyboard.press('Escape');

  await page.getByLabel('Mais ações').click();
  await page.getByText('Selecionar arquivo').click();
  await expect(page.getByRole('dialog', { name: 'Selecionar arquivo' })).toBeVisible();
  await page.getByText('relatorio-final-com-nome-muito-longo-para-validar-chip-premium.md').click();
  await page.getByRole('button', { name: 'Selecionar', exact: true }).click();
  await expect(page.getByLabel('Arquivos selecionados')).toBeVisible();
  await screenshot(page, 'pass-13-attachment-chip');

  await page.getByLabel(/Iniciar Bate-papo Temporário/).click();
  await page.getByPlaceholder('Como posso ajudá-lo hoje?').fill('Responda no temporário');
  await page.getByLabel('Enviar').click();
  await expect(page.getByText('Resposta temporária real do provider.')).toBeVisible();
  await screenshot(page, 'pass-13-temporary-chat-response');
});

test('captura chat normal, markdown e scrollbar longa', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openApp(page, 'dark');
  await page.getByText('Passada visual').click();
  await expect(page.getByText(/Markdown limpo/)).toBeVisible();
  await screenshot(page, 'pass-13-chat-normal');
  await screenshot(page, 'pass-13-chat-markdown');
  await screenshot(page, 'pass-13-chat-long-scrollbar');
});

test('captura configurações em todas as abas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openApp(page, 'dark');
  await page.getByLabel('Menu do usuário').click();
  await page.getByText('Configurações').click();
  await expect(page.getByRole('dialog', { name: 'Configurações' })).toBeVisible();
  await screenshot(page, 'pass-13-settings-general');

  const dialog = page.getByRole('dialog', { name: 'Configurações' });
  await dialog.getByRole('button', { name: 'Interface' }).click();
  await screenshot(page, 'pass-13-settings-interface');
  await dialog.getByRole('button', { name: 'Modelos' }).click();
  await screenshot(page, 'pass-13-settings-models');
  await dialog.getByRole('button', { name: 'Conversas' }).click();
  await screenshot(page, 'pass-13-settings-conversations');
  await dialog.getByRole('button', { name: 'Personalização' }).click();
  await screenshot(page, 'pass-13-settings-personalization');
});

test('captura tema claro, composer, settings e seletor', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openApp(page, 'light');
  await screenshot(page, 'pass-13-home-light');
  await page.getByPlaceholder('Como posso ajudá-lo hoje?').focus();
  await screenshot(page, 'pass-13-composer-focus-light');
  await page.getByTitle(/mock-development-model/).click();
  await screenshot(page, 'pass-13-model-selector-light');
  await page.keyboard.press('Escape');
  await page.getByLabel('Menu do usuário').click();
  await page.getByText('Configurações').click();
  await screenshot(page, 'pass-13-settings-light');
});

test('captura estado de configuração STT', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openApp(page, 'dark');
  await page.getByLabel('Entrada por voz').click();
  await expect(page.getByText(/Backend local não configurado|Microfone indisponível|Permissão negada|Nenhum microfone/)).toBeVisible();
  await page.getByText('Configurar transcrição local').click();
  await expect(page.getByRole('dialog', { name: 'Configurar transcrição local' })).toBeVisible();
  await screenshot(page, 'pass-13-stt-config');
  await screenshot(page, 'pass-13-stt-error-real');
});

test('mantém data fixa para evitar ruído de screenshots', () => {
  expect(nowIso()).toBe('2026-05-09T12:00:00.000Z');
});
