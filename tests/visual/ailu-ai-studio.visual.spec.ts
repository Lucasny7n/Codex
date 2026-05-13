import { expect, test, type Page } from '@playwright/test';

const nodeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
const screenshotDir = nodeProcess?.env?.AILU_SCREENSHOT_DIR ?? 'test-results/screenshots';

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
  return new Date('2026-05-10T12:00:00.000Z').toISOString();
}

async function installTauriMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const now = '2026-05-10T12:00:00.000Z';
    window.localStorage.setItem('ailu-sidebar-conversations-open', 'true');
    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: () => Promise.reject(new DOMException('Microfone bloqueado no mock visual.', 'NotAllowedError')),
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
          reasoningSummary: 'Resumo interno de validação visual.',
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
        customizeAilu: false,
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
    const providerProfiles = [
      {
        id: 'openai-api:principal',
        providerId: 'openai-api',
        providerLabel: 'OpenAI API',
        name: 'Principal',
        authType: 'api_key',
        status: 'testing',
        maskedCredential: 'sk-t****1234',
        source: 'config_file',
        isDefault: true,
        message: 'Credencial salva; teste conexão antes de usar como ready.',
      },
    ];

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

    const tauriCallbacks = new Map<number, unknown>();
    const tauriEventHandlers = new Map<string, number[]>();
    const emitTauriEvent = (event: string, payload: unknown) => {
      for (const handlerId of tauriEventHandlers.get(event) ?? []) {
        const callback = tauriCallbacks.get(handlerId);
        if (typeof callback === 'function') {
          callback({ event, id: handlerId, payload });
        }
      }
    };

    window.__TAURI_INTERNALS__ = {
      transformCallback: (callback: unknown) => {
        const id = Math.floor(Math.random() * 1_000_000);
        tauriCallbacks.set(id, callback);
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
            workspaceMeta: { root: '/tmp/workspace', repoName: 'Ailu Projeto', branch: 'main', headShort: 'abc1234', dirty: false },
            sessions: [session],
            pendingPermissions: [],
            providers: [provider],
            providerProfiles,
            agentProfiles: [{ id: 'equilibrado', label: 'Equilibrado', description: 'Diagnóstico sólido.', mode: 'equilibrado' }],
            memory: { profileSummary: 'Resumo', userPreferences: [], activeProjects: [], importantFixHistory: [], operationalPolicies: [] },
            theme: { source: 'visual', accentPrimary: '#2d95ec', accentSecondary: '#8cc8ff', background: '#08080d' },
          };
        }
        if (cmd === 'list_provider_credentials') return [];
        if (cmd === 'list_provider_profiles') return providerProfiles;
        if (cmd === 'list_privileged_actions') return [];
        if (cmd === 'get_local_runtime_state') return {
          ...localRuntime,
          installedModels: [...localRuntime.installedModels],
        };
        if (cmd === 'search_ollama_library') {
          const query = String(args?.query ?? '').toLowerCase();
          if (query.includes('gpt')) {
            return [
              { modelId: 'gpt-oss:20b', label: 'gpt-oss:20b', family: 'GPT-OSS', sizeLabel: '13 GB' },
              { modelId: 'gpt-oss:120b', label: 'gpt-oss:120b', family: 'GPT-OSS', sizeLabel: '65 GB' },
            ];
          }
          if (query.includes('llama')) {
            return [
              { modelId: 'llama3.2', label: 'llama3.2', family: 'Llama' },
              { modelId: 'llama3.1', label: 'llama3.1', family: 'Llama' },
            ];
          }
          return [];
        }
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
            capture: {
              webviewStatus: 'ok',
              webviewMessage: 'PipeWire, WirePlumber e portal ativos.',
              nativeStatus: 'ok',
              nativeMessage: 'Fallback nativo disponível via pw-record.',
              nativeTools: ['pw-record'],
            },
            checkedAt: now,
          };
        }
        if (cmd === 'record_and_transcribe_short_test') {
          return {
            status: 'error',
            message: 'Não consegui gravar áudio pelo fallback nativo. Verifique o dispositivo de entrada.',
            backend: 'native-capture',
            captureStatus: 'error',
            captureBackend: 'pw-record',
          };
        }
        if (cmd === 'get_app_health_check') {
          return {
            baseDir: '/tmp/workspace',
            expectedBaseDir: '/tmp/workspace',
            correctBaseDir: true,
            branch: 'main',
            nodeOk: true,
            npmOk: true,
            cargoOk: true,
            tauriOk: true,
            providers: [provider],
            ollama: localRuntime,
            credentialsEncrypted: true,
            items: [
              { id: 'ollama-installed', label: 'Ollama instalado', status: 'ok', detail: 'Runtime encontrado no PATH.' },
              { id: 'ollama-api', label: 'Ollama API ativa', status: 'ok', detail: 'http://127.0.0.1:11434' },
              { id: 'stt-backend', label: 'Backend STT', status: 'warning', detail: 'Backend Whisper/Vosk ausente.', action: 'Configurar transcrição local', command: 'sudo pacman -S --needed ffmpeg whisper.cpp' },
              { id: 'microphone-webview', label: 'Captura WebView', status: 'warning', detail: 'Captura ainda não testada no WebView.', action: 'Testar microfone' },
              { id: 'microphone-native', label: 'Captura nativa', status: 'ok', detail: 'Fallback nativo disponível via pw-record.', action: 'Gravar teste curto' },
              { id: 'api-keys', label: 'API keys', status: 'warning', detail: 'Credencial salva exige teste antes de ficar pronta.', action: 'Testar conexão' },
              { id: 'git-workspace', label: 'Git/workspace', status: 'ok', detail: '/tmp/workspace · main' },
            ],
            recentErrors: [],
            overallStatus: 'warning',
            actions: [],
          };
        }
        if (cmd === 'send_temporary_order_to_agent') {
          if (String(args?.content ?? '').toLowerCase().includes('loading')) {
            await new Promise((resolve) => window.setTimeout(resolve, 900));
          }
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
        if (cmd === 'install_local_model') {
          const modelId = String(args?.modelId ?? 'qwen3:8b');
          emitTauriEvent('local-model-progress', {
            modelId,
            state: 'running',
            progressPercent: 42,
            downloaded: '1.2 GB',
            total: '4.7 GB',
            speed: '22.5 MB/s',
            message: 'Baixando camadas do Ollama',
            at: now,
          });
          await new Promise((resolve) => window.setTimeout(resolve, 120));
          localRuntime.installedModels = [...localRuntime.installedModels, { id: modelId }];
          return {
            ...localRuntime,
            installedModels: [...localRuntime.installedModels],
          };
        }
        if (cmd === 'plugin:event|listen') {
          const event = String(args?.event ?? '');
          const handler = Number(args?.handler);
          tauriEventHandlers.set(event, [...(tauriEventHandlers.get(event) ?? []), handler]);
          return handler;
        }
        if (cmd === 'plugin:event|unlisten') {
          const event = String(args?.event ?? '');
          const id = Number(args?.id);
          tauriEventHandlers.set(event, (tauriEventHandlers.get(event) ?? []).filter((handlerId) => handlerId !== id));
          return undefined;
        }
        if (cmd === 'update_settings') return args?.settings;
        if (cmd === 'export_all_conversations') return { path: '/tmp/ailu-conversas.json', format: 'json', bytes: 100 };
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

test('captura home, composer, chat temporário, seletor e modais em tema escuro', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openApp(page, 'dark');
  await expect(page.locator('.prompt-preset-select')).toHaveCount(0);
  await expect(page.locator('select[aria-label="Selecionar preset"]')).toHaveCount(0);
  await screenshot(page, 'pass-15-home-dark');
  await screenshot(page, 'pass-21-home-dark');
  await screenshot(page, 'pass-22-home-dark');
  await screenshot(page, 'pass-23-home-dark');
  await screenshot(page, 'pass-19-home-no-preset-select');
  await screenshot(page, 'pass-15-composer-empty');
  await screenshot(page, 'pass-15-send-disabled-neutral');
  await screenshot(page, 'pass-15-app-icon');

  const input = page.getByPlaceholder('Como posso ajudá-lo hoje?');
  await input.focus();
  await screenshot(page, 'pass-15-home-focus');
  await screenshot(page, 'pass-15-composer-focused-no-purple-box');
  await input.fill('Validar envio ativo');
  await screenshot(page, 'pass-15-home-ready-send');
  await screenshot(page, 'pass-15-composer-ready-send');
  await screenshot(page, 'pass-15-send-active-accent');

  await page.getByLabel('Selecionar modo de resposta').click();
  await screenshot(page, 'pass-15-mode-selector');
  await page.getByRole('button', { name: /Terminal/ }).click();
  await screenshot(page, 'pass-15-mode-terminal-clean');
  await page.keyboard.press('Escape');

  await page.getByTitle(/mock-development-model/).click();
  await expect(page.locator('.model-picker-title')).toHaveText('Modelos');
  await expect(page.getByText('Qwen2.5 Coder 1.5B')).toHaveCount(0);
  await expect(page.getByText('Local Ollama')).toHaveCount(0);
  await screenshot(page, 'pass-15-model-selector-cloud');
  await screenshot(page, 'pass-21-model-selector-cloud');
  await screenshot(page, 'pass-23-model-selector-cloud');
  await screenshot(page, 'pass-19-cloud-no-local-ollama');
  await screenshot(page, 'pass-20-cloud-no-local');
  await page.getByLabel('Buscar modelo ou provedor').fill('qwen2.5-coder');
  await expect(page.getByText('Nenhum modelo cloud configurado encontrado.')).toBeVisible();
  await page.getByLabel('Buscar modelo ou provedor').fill('GPT-5.5');
  await page.getByTestId('model-row-gpt-5.5').hover();
  await screenshot(page, 'pass-15-model-selector-cloud-hover');
  await screenshot(page, 'pass-15-model-selector-hover-full-row');
  await screenshot(page, 'pass-15-model-selector-ellipsis-aligned');
  await page.getByLabel('Configurar GPT-5.5').click();
  await expect(page.getByRole('dialog', { name: 'GPT-5.5' })).toBeVisible();
  await screenshot(page, 'pass-15-model-config-cloud');
  await screenshot(page, 'pass-15-model-config-cloud-keys');
  await page.keyboard.press('Escape');

  await page.getByTitle(/mock-development-model/).click();
  await page.getByRole('tab', { name: 'Local' }).click();
  await screenshot(page, 'pass-20-local-empty-installed');
  await screenshot(page, 'pass-21-model-selector-local-empty');
  await page.getByLabel('Buscar modelos Ollama').fill('GPT-5.5');
  await expect(page.getByText('Nenhum modelo Ollama encontrado para esta busca.')).toBeVisible();
  await page.getByLabel('Buscar modelos Ollama').fill('gpt oss');
  await expect(page.getByTestId('model-row-ollama-download:gpt-oss:20b')).toBeVisible();
  await expect(page.getByText('gpt-oss:20b')).toBeVisible();
  await expect(page.getByText('gpt-oss:120b')).toBeVisible();
  await expect(page.getByTestId('model-row-ollama-download:gpt-oss:20b').getByText('Download')).toBeVisible();
  await expect(page.getByText('Disponível para pull')).toHaveCount(0);
  await screenshot(page, 'pass-19-local-search-gpt-oss');
  await screenshot(page, 'pass-20-local-search-gpt-oss');
  await screenshot(page, 'pass-21-model-selector-local-gpt-oss');
  await screenshot(page, 'pass-22-local-gpt-oss');
  await screenshot(page, 'pass-23-local-gpt-oss');
  await page.getByTestId('model-row-ollama-download:gpt-oss:20b').hover();
  await screenshot(page, 'pass-19-model-selector-ellipsis-aligned');
  await screenshot(page, 'pass-20-ellipsis-aligned');
  await screenshot(page, 'pass-21-model-selector-ellipsis');
  await screenshot(page, 'pass-22-ellipsis-hover');
  await screenshot(page, 'pass-23-ellipsis-hover');
  await page.getByLabel('Configurar gpt-oss:20b').click();
  await expect(page.getByRole('dialog', { name: 'gpt-oss:20b' })).toBeVisible();
  await expect(page.getByTitle(/mock-development-model/)).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByTitle(/mock-development-model/).click();
  await page.getByRole('tab', { name: 'Local' }).click();
  await page.getByLabel('Buscar modelos Ollama').fill('llama');
  await expect(page.getByText('llama3.2')).toBeVisible();
  await screenshot(page, 'pass-20-local-search-llama');
  await page.getByLabel('Buscar modelos Ollama').fill('Qwen');
  await screenshot(page, 'pass-15-model-selector-local');
  await page.getByTestId('model-row-qwen2.5-coder:1.5b').hover();
  await screenshot(page, 'pass-15-model-selector-local-hover');
  await page.getByLabel('Configurar qwen2.5-coder:1.5b').click();
  await expect(page.getByRole('dialog', { name: 'qwen2.5-coder:1.5b' })).toBeVisible();
  await screenshot(page, 'pass-15-model-config-local-installed');
  await page.keyboard.press('Escape');

  await page.getByTitle(/mock-development-model/).click();
  await page.getByRole('tab', { name: 'Local' }).click();
  await page.getByLabel('Buscar modelos Ollama').fill('qwen3:8b');
  await page.getByTestId('model-row-ollama-download:qwen3:8b').hover();
  await page.getByLabel('Configurar qwen3:8b').click();
  await expect(page.getByRole('dialog', { name: 'qwen3:8b' })).toBeVisible();
  await screenshot(page, 'pass-15-model-config-local-download');
  await page.getByRole('button', { name: /Download/ }).click();
  await expect(page.locator('.model-config-progress').getByText(/42%/)).toBeVisible();
  await screenshot(page, 'pass-15-model-config-local-download-progress');
  await page.getByRole('dialog', { name: 'qwen3:8b' }).getByRole('button', { name: 'Fechar' }).click();
  await expect(page.getByRole('dialog', { name: 'qwen3:8b' })).toHaveCount(0);

  await page.getByLabel('Mais ações').click();
  await page.getByText('Selecionar arquivo').click();
  await expect(page.getByRole('dialog', { name: 'Selecionar arquivo' })).toBeVisible();
  await page.getByText('relatorio-final-com-nome-muito-longo-para-validar-chip-premium.md').click();
  await page.getByRole('button', { name: 'Selecionar', exact: true }).click();
  await expect(page.getByLabel('Arquivos selecionados')).toBeVisible();

  await page.getByLabel(/Iniciar Bate-papo Temporário/).click();
  await page.getByPlaceholder('Como posso ajudá-lo hoje?').fill('loading visual temporário');
  await page.getByLabel('Enviar').click();
  await expect(page.getByLabel('Assistente respondendo')).toBeVisible();
  await screenshot(page, 'pass-15-temporary-loading');
  await screenshot(page, 'pass-15-loading-dots');
  await screenshot(page, 'pass-15-after-send-composer-cleared');
  await expect(page.getByText('Resposta temporária real do provider.')).toBeVisible();
  await expect(page.getByText('Pensamento concluído')).toHaveCount(0);
  await screenshot(page, 'pass-15-temporary-chat-real-response');
  await screenshot(page, 'pass-15-temporary-real-response');
  await screenshot(page, 'pass-15-temporary-no-thinking-label');
});

test('captura chat normal, markdown e scrollbar longa', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openApp(page, 'dark');
  await page.getByText('Passada visual').click();
  await expect(page.getByText(/Markdown limpo/)).toBeVisible();
  await expect(page.getByText('Pensamento concluído')).toHaveCount(0);
  await screenshot(page, 'pass-15-chat-no-thinking-label');
  await screenshot(page, 'pass-21-chat-clean');
  await screenshot(page, 'pass-22-chat-markdown');
  await screenshot(page, 'pass-23-chat-markdown');
  await screenshot(page, 'pass-15-chat-long-scrollbar');
  await screenshot(page, 'pass-21-chat-long-scrollbar');
});

test('captura configurações em todas as abas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openApp(page, 'dark');
  await page.getByLabel('Menu do usuário').click();
  await page.getByText('Configurações').click();
  await expect(page.getByRole('dialog', { name: 'Configurações' })).toBeVisible();
  await screenshot(page, 'pass-15-settings-general-dark');
  await screenshot(page, 'pass-21-settings-general-dark');

  const dialog = page.getByRole('dialog', { name: 'Configurações' });
  await dialog.getByRole('button', { name: 'Modelos' }).click();
  await screenshot(page, 'pass-15-settings-modelos');
  await screenshot(page, 'pass-15-settings-models');
  await screenshot(page, 'pass-21-model-manager');
  await dialog.getByRole('button', { name: 'Saúde' }).click();
  await dialog.getByRole('button', { name: 'Atualizar' }).click();
  await expect(dialog.getByText('Ollama API ativa')).toBeVisible();
  await screenshot(page, 'pass-21-settings-health');
  await screenshot(page, 'pass-22-settings-health');
  await screenshot(page, 'pass-23-settings-health');
  await dialog.getByRole('button', { name: 'Personalização' }).click();
  await screenshot(page, 'pass-15-settings-personalization');
});

test('captura tema claro, composer, settings e seletor', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openApp(page, 'light');
  await screenshot(page, 'pass-15-home-light');
  await screenshot(page, 'pass-21-home-light');
  await screenshot(page, 'pass-22-home-light');
  await screenshot(page, 'pass-23-home-light');
  await page.getByPlaceholder('Como posso ajudá-lo hoje?').fill('Enviar visível no tema claro');
  await screenshot(page, 'pass-15-home-light-send-visible');
  await page.getByPlaceholder('Como posso ajudá-lo hoje?').focus();
  await page.getByLabel('Menu do usuário').click();
  await page.getByText('Configurações').click();
  await screenshot(page, 'pass-15-settings-general-light');
  await screenshot(page, 'pass-21-settings-general-light');
});

test('captura estado de configuração STT', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openApp(page, 'dark');
  await page.getByLabel('Entrada por voz').click();
  await expect(page.getByText(/Não consegui gravar áudio pelo fallback nativo|Backend local não configurado|Microfone indisponível/)).toBeVisible();
  await screenshot(page, 'pass-15-mic-permission-flow');
  await page.getByText(/Configurar microfone|Configurar transcrição local/).click();
  await expect(page.getByRole('dialog', { name: 'Transcrição e microfone' })).toBeVisible();
  await screenshot(page, 'pass-15-mic-state');
  await screenshot(page, 'pass-15-mic-config');
  await screenshot(page, 'pass-21-mic-diagnostic');
});

test('mantém data fixa para evitar ruído de screenshots', () => {
  expect(nowIso()).toBe('2026-05-10T12:00:00.000Z');
});
