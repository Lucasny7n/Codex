import { useEffect, useMemo, useState } from 'react';
import {
  bootstrapState,
  archiveSession,
  archiveAllSessions,
  createSession,
  deleteAllSessions,
  deleteSession,
  duplicateSession,
  exportAllConversations,
  exportSession,
  getLocalRuntimeState,
  installLocalModel,
  importConversations,
  listArchivedSessions,
  listProviderCredentials,
  listProviderProfiles,
  listPrivilegedActions,
  onCommandLog,
  onFileChanged,
  onLocalModelProgress,
  onLocalRuntimeState,
  onPermissionOutcome,
  onPermissionRaised,
  onPermissionResolved,
  onSessionChanged,
  onStatusNote,
  openFileInVscode,
  openProjectInVscode,
  requestExecution,
  requestPrivilegedAction,
  renameSession,
  restoreSession,
  removeLocalModel,
  removeProviderProfile,
  renameProviderProfile,
  saveProviderProfileCredential,
  sendOrderToAgent,
  sendTemporaryOrderToAgent,
  setDefaultProviderProfile,
  startLocalRuntime,
  testProviderConnection,
  updateSettings,
} from '../lib/api';
import { shellQuote, trimMultiline } from '../lib/utils/format';
import {
  modelRegistry,
  type CloudModelProfile,
  type LocalModelProfile,
} from '../lib/models/modelRegistry';
import {
  buildCloudModelOptions,
  buildLocalModelOptions,
  isLocalModelInstalled,
  normalizeOllamaModelId,
} from '../lib/models/modelCatalogService';
import { translateError } from '../lib/utils/errorTranslator';
import {
  buildProjectMemoryAttachment,
  updateProjectMemoryFromExchange,
} from '../lib/memory/projectMemoryService';
import { applyAppTheme } from '../lib/theme';
import {
  canSelectModel,
  resolveModelStatus,
} from '../lib/providers/status';
import type {
  AppSettings,
  ExecutionMode,
  AgentSession,
  ChatMessage,
  LocalModelInstallProgress,
  LocalRuntimeSnapshot,
  PrivilegedActionSpec,
  ProviderCredentialStatus,
  ProviderAccountProfile,
  ProviderRuntimeStatus,
  ProviderStatusState,
  EnvironmentSelectionInput,
  SelectedFileAttachment,
  ChatAttachment,
} from '../types/domain';
import { useAppStore } from '../stores/appStore';

import { AppShell } from '../components/layout/AppShell';
import { TopBar, type TopBarModelOption } from '../components/layout/TopBar';
import { SessionsPanel } from '../components/panels/SessionsPanel';
import { ChatPanel } from '../components/chat/ChatPanel';
import { SettingsPanel, type SettingsTab } from '../components/settings/SettingsPanel';
import { CommandInputPanel, type InputModeId } from '../components/chat/CommandInputPanel';
import { ArchivedConversationsModal } from '../components/chat/ArchivedConversationsModal';
import { TerminalDrawer } from '../components/panels/TerminalDrawer';
import { HelpDrawer } from '../components/panels/HelpDrawer';
import type { EnvironmentTab } from '../components/models/ModelSelector';
import { FileManagerModal } from '../components/file/FileManagerModal';
import { UiIcon, type UiIconName } from '../components/common/AppIcons';
import {
  ConfirmDialog,
  ExportDialog,
  PremiumModal,
  PopupMenu,
  ToastViewport,
  type ToastMessage,
} from '../components/common/PremiumUI';

function homeFromCodexRoot(settings?: AppSettings): string | undefined {
  if (!settings?.codexRoot) return undefined;
  return settings.codexRoot.endsWith('/.codex') ? settings.codexRoot.slice(0, -'/.codex'.length) : undefined;
}

function buildActionJsonExamples(settings?: AppSettings): Record<string, string> {
  const codexRoot = settings?.codexRoot ?? '~/.codex';
  const home = homeFromCodexRoot(settings) ?? '~';

  return {
    systemctl_enable_service: '{\n  "service": "fstrim.timer"\n}',
    systemctl_disable_service: '{\n  "service": "waydroid-container.service"\n}',
    systemctl_restart_service: '{\n  "service": "waydroid-container.service"\n}',
    systemctl_status_service: '{\n  "service": "waydroid-container.service"\n}',
    bootctl_set_default_kernel: '{\n  "entry": "arch-linux-cachyos-bore.conf"\n}',
    chmod_random_seed: '{}',
    backup_file: '{\n  "path": "/boot/loader/loader.conf"\n}',
    restore_file: `{\n  "backupPath": "${codexRoot}/codex-ui/backups/exemplo.bak",\n  "targetPath": "/boot/loader/loader.conf"\n}`,
    pacman_install_packages: '{\n  "packages": ["ripgrep"]\n}',
    paccache_keep_versions: '{\n  "keep": 2\n}',
    waydroid_start: '{}',
    waydroid_stop: '{}',
    waydroid_status: '{}',
    hyprland_verify_config: `{\n  "configPath": "${home}/.config/hypr/hyprland.conf"\n}`,
    hyprland_reload_user: '{}',
  };
}

function pushHistory(settings: AppSettings, mode: ExecutionMode, providerId: string, modelId: string): AppSettings {
  const entry = {
    mode,
    providerId,
    modelId,
    at: new Date().toISOString(),
  };

  const history = [
    entry,
    ...settings.modelSelectionHistory.filter(
      (item) => !(item.mode === mode && item.providerId === providerId && item.modelId === modelId),
    ),
  ].slice(0, 30);

  return {
    ...settings,
    modelSelectionHistory: history,
  };
}

function accountStatusFromProviderState(
  state: ProviderStatusState,
  profile: ProviderAccountProfile,
): ProviderAccountProfile['status'] {
  if (state === 'ready') return 'ready';
  if (state === 'requires_api_key') return profile.maskedCredential ? 'testing' : 'requires_api_key';
  if (state === 'invalid_api_key') return 'invalid_api_key';
  if (state === 'forbidden') return 'forbidden';
  if (state === 'requires_login') return 'requires_login';
  if (state === 'requires_oauth') return 'requires_oauth';
  if (state === 'requires_cli_auth') return 'requires_cli_auth';
  if (state === 'testing' || state === 'running') return 'testing';
  if (state === 'quota_exceeded') return 'quota_exceeded';
  if (state === 'rate_limited') return 'rate_limited';
  if (state === 'provider_unavailable') return 'provider_unavailable';
  if (state === 'misconfigured' || state === 'not_configured') return 'misconfigured';
  if (state === 'experimental' || state === 'mock') return 'experimental';
  return 'unavailable';
}

function titleFromContent(content: string): string {
  const compact = content
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-–—\s]+/, '');
  if (!compact) {
    return `Conversa ${new Date().toLocaleString('pt-BR')}`;
  }
  return compact.length > 54 ? `${compact.slice(0, 51)}...` : compact;
}

function readLocalStorage(key: string): string | undefined {
  const storage = window.localStorage;
  if (!storage || typeof storage.getItem !== 'function') return undefined;
  try {
    return storage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeLocalStorage(key: string, value: string): void {
  const storage = window.localStorage;
  if (!storage || typeof storage.setItem !== 'function') return;
  try {
    storage.setItem(key, value);
  } catch {
    // Persistência de UI é opcional; o estado em memória continua válido.
  }
}

function removeLocalStorage(key: string): void {
  const storage = window.localStorage;
  if (!storage || typeof storage.removeItem !== 'function') return;
  try {
    storage.removeItem(key);
  } catch {
    // Remoção local também é opcional para a execução principal.
  }
}

function readSavedProjects(): string[] {
  try {
    const raw = readLocalStorage('codex-command-center-projects');
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function readInitialActiveProject(savedProjects: string[]): string | undefined {
  const active = readLocalStorage('codex-command-center-active-project')?.trim();
  if (!active) return undefined;
  if (savedProjects.includes(active)) return active;
  writeLocalStorage('codex-command-center-active-project', '');
  return undefined;
}

function readProjectMeta(project: string): StoredProjectMeta | undefined {
  try {
    const raw = readLocalStorage(`codex-command-center-project:${project}`);
    const parsed: unknown = raw ? JSON.parse(raw) : undefined;
    if (!parsed || typeof parsed !== 'object') return undefined;
    const candidate = parsed as Partial<StoredProjectMeta> & {
      memory?: string;
      icon?: string;
      color?: string;
    };
    return {
      title: typeof candidate.title === 'string' ? candidate.title : project,
      instructions: typeof candidate.instructions === 'string' ? candidate.instructions : '',
      memoryScope: candidate.memoryScope === 'project' ? 'project' : 'default',
      presetId: PROJECT_PRESETS.some((preset) => preset.id === candidate.presetId) ? candidate.presetId : undefined,
      files: Array.isArray(candidate.files) ? candidate.files.filter((item): item is string => typeof item === 'string') : [],
      updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString(),
    };
  } catch {
    return undefined;
  }
}

function ProjectFolderIcon(): JSX.Element {
  return <UiIcon name="folder" className="project-workspace-icon" />;
}

type ProjectMemoryScope = 'default' | 'project';
type ProjectPresetId = 'investment' | 'homework' | 'writing' | 'health' | 'travel';

interface StoredProjectMeta {
  title: string;
  instructions: string;
  memoryScope: ProjectMemoryScope;
  presetId?: ProjectPresetId;
  files: string[];
  updatedAt: string;
}

const PROJECT_PRESETS: Array<{ id: ProjectPresetId; label: string; icon: UiIconName; instructions: string }> = [
  {
    id: 'investment',
    label: 'Investimento',
    icon: 'chart',
    instructions: 'Trate o projeto como acompanhamento de investimento. Priorize riscos, premissas, números verificáveis e decisões auditáveis.',
  },
  {
    id: 'homework',
    label: 'Tarefa de casa',
    icon: 'book',
    instructions: 'Ajude a resolver tarefas passo a passo, explicando raciocínio, fontes usadas e próximos exercícios.',
  },
  {
    id: 'writing',
    label: 'Escrita',
    icon: 'pen',
    instructions: 'Atue como editor de escrita. Preserve intenção, melhore clareza, estrutura, tom e consistência.',
  },
  {
    id: 'health',
    label: 'Saúde',
    icon: 'heart',
    instructions: 'Organize informações de saúde com cautela. Diferencie orientação geral de decisão médica e recomende validação profissional quando necessário.',
  },
  {
    id: 'travel',
    label: 'Viagem',
    icon: 'plane',
    instructions: 'Planeje viagem com foco em orçamento, datas, deslocamentos, reservas, documentos e alternativas práticas.',
  },
];

const PROJECT_MEMORY_OPTIONS: Array<{ id: ProjectMemoryScope; label: string; description: string }> = [
  {
    id: 'default',
    label: 'Padrão',
    description: 'Os chats acessarão as memórias da sua conta e contribuirão para elas.',
  },
  {
    id: 'project',
    label: 'Apenas projeto',
    description: 'As memórias ficam isoladas neste projeto e não afetam a conta principal.',
  },
];

function projectNameFromPath(path: string | undefined): string | undefined {
  if (!path) return undefined;
  const clean = path.trim().replace(/\/$/, '');
  return clean.split('/').filter(Boolean).at(-1);
}

function cleanSidebarProjectName(value: string): string | undefined {
  const clean = value.trim();
  if (!clean) return undefined;
  if (clean.includes('/home/lucas/Codex') && !clean.includes('/home/lucas/Codex-Codex')) return undefined;
  if (clean.startsWith('~/.codex')) return undefined;
  if (clean.includes('/')) {
    const pathPart = clean.split(/\s|\(/u)[0];
    return projectNameFromPath(pathPart);
  }
  return clean.length > 38 ? `${clean.slice(0, 35)}...` : clean;
}

function safeAgentProfileId(value: string | undefined): string {
  return value && value !== 'agressivo' ? value : 'equilibrado';
}

function createOptimisticUserMessage(content: string, attachments: ChatAttachment[]): ChatMessage {
  return {
    id: `optimistic-user-${Date.now()}`,
    role: 'user',
    content,
    createdAt: new Date().toISOString(),
    attachments,
  };
}

export default function App(): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [privilegedActions, setPrivilegedActions] = useState<PrivilegedActionSpec[]>([]);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [localRuntime, setLocalRuntime] = useState<LocalRuntimeSnapshot>();
  const [localRuntimeLoading, setLocalRuntimeLoading] = useState(false);
  const [modelActionBusyId, setModelActionBusyId] = useState<string>();
  const [installationProgress, setInstallationProgress] = useState<Record<string, LocalModelInstallProgress>>({});
  const [providerCredentials, setProviderCredentials] = useState<ProviderCredentialStatus[]>([]);
  const [providerAccountProfiles, setProviderAccountProfiles] = useState<ProviderAccountProfile[]>([]);
  const [settingsTabRequest, setSettingsTabRequest] = useState<{ tab: SettingsTab; nonce: number }>();
  const [sessionInfoId, setSessionInfoId] = useState<string>();
  const [controlModalOpen, setControlModalOpen] = useState(false);
  const [archivedModalOpen, setArchivedModalOpen] = useState(false);
  const [archivedSessions, setArchivedSessions] = useState<AgentSession[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archivedError, setArchivedError] = useState<string>();
  const [deleteSessionTarget, setDeleteSessionTarget] = useState<AgentSession>();
  const [exportSessionTarget, setExportSessionTarget] = useState<AgentSession>();
  const [projectConversationMenuId, setProjectConversationMenuId] = useState<string>();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [temporaryChatActive, setTemporaryChatActive] = useState(false);
  const [temporaryMessages, setTemporaryMessages] = useState<ChatMessage[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readLocalStorage('codex-sidebar-collapsed') === 'true');
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectFileManagerOpen, setProjectFileManagerOpen] = useState(false);
  const [editingProjectName, setEditingProjectName] = useState<string>();
  const [projectAdvancedOpen, setProjectAdvancedOpen] = useState(false);
  const [projectMemoryMenuOpen, setProjectMemoryMenuOpen] = useState(false);
  const [savedProjects, setSavedProjects] = useState<string[]>(readSavedProjects);
  const [activeProject, setActiveProject] = useState(() => readInitialActiveProject(readSavedProjects()));
  const [projectName, setProjectName] = useState('');
  const [projectInstructions, setProjectInstructions] = useState('');
  const [projectMemoryScope, setProjectMemoryScope] = useState<ProjectMemoryScope>('default');
  const [projectPreset, setProjectPreset] = useState<ProjectPresetId>();
  const [projectFiles, setProjectFiles] = useState<string[]>([]);
  const [projectSessionIds, setProjectSessionIds] = useState<Record<string, string[]>>(() => {
    try {
      const raw = readLocalStorage('codex-command-center-project-sessions');
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      if (!parsed || typeof parsed !== 'object') return {};
      const entries = Object.entries(parsed as Record<string, unknown>)
        .map(([project, value]) => [
          project,
          Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [],
        ] as const)
        .filter(([project]) => project.trim().length > 0);
      return Object.fromEntries(entries);
    } catch {
      return {};
    }
  });
  const {
    booted,
    loading,
    error,
    settings,
    providers,
    providerProfiles,
    profiles,
    theme,
    sessions,
    selectedSessionId,
    logs,
    selectedModelId,
    executionMode,
    setError,
    setLoading,
    bootstrap,
    upsertSession,
    replaceSessions,
    removeSession,
    selectSession,
    appendStatus,
    appendLog,
    pushFileChange,
    addPermission,
    removePermission,
    recordPermissionOutcome,
    updateSettings: syncSettings,
    updateProviderStatus,
    selectModel,
    setExecutionMode,
  } = useAppStore();

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId),
    [sessions, selectedSessionId],
  );

  const temporarySession = useMemo<AgentSession | undefined>(() => {
    if (!temporaryChatActive) return undefined;
    const now = new Date().toISOString();
    return {
      id: 'temporary-chat',
      title: 'Bate-papo Temporário',
      createdAt: temporaryMessages[0]?.createdAt ?? now,
      updatedAt: temporaryMessages.at(-1)?.createdAt ?? now,
      status: 'idle',
      messages: temporaryMessages,
      tasks: [],
      providerId: settings?.selectedProviderId,
      modelId: settings?.selectedModelId,
      agentProfileId: settings?.selectedAgentId,
      accountProfileId: settings?.selectedProviderProfileId,
    };
  }, [settings, temporaryChatActive, temporaryMessages]);

  const sessionInfo = useMemo(
    () => sessions.find((session) => session.id === sessionInfoId),
    [sessionInfoId, sessions],
  );

  const sidebarProjects = useMemo(() => {
    const projects = savedProjects
      .map((item) => cleanSidebarProjectName(item ?? ''))
      .filter((item): item is string => Boolean(item));
    return Array.from(new Set(projects)).slice(0, 12);
  }, [savedProjects]);

  const projectSessionsByName = useMemo(() => {
    const byId = new Map(sessions.map((session) => [session.id, session]));
    const next: Record<string, AgentSession[]> = {};
    for (const project of sidebarProjects) {
      const ids = projectSessionIds[project] ?? [];
      next[project] = ids
        .map((id) => byId.get(id))
        .filter((session): session is AgentSession => Boolean(session))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    return next;
  }, [projectSessionIds, sessions, sidebarProjects]);

  const activeProjectConversations = activeProject ? projectSessionsByName[activeProject] ?? [] : [];

  const actionJsonExamples = useMemo(() => buildActionJsonExamples(settings), [settings]);

  const effectiveProviderProfiles = useMemo(() => {
    const source = providerAccountProfiles.length > 0 ? providerAccountProfiles : providerProfiles;
    return source.map((profile) => {
      const provider = providers.find((item) => item.id === profile.providerId);
      if (!provider) return profile;
      if (profile.source === 'config_file') {
        return {
          ...profile,
          providerLabel: provider.label,
        };
      }
      const statusFromProvider = accountStatusFromProviderState(provider.status.state, profile);
      const explicitFailure = [
        'invalid_api_key',
        'forbidden',
        'quota_exceeded',
        'rate_limited',
        'provider_unavailable',
        'misconfigured',
      ].includes(profile.status);
      const status = provider.status.state === 'testing' && explicitFailure
        ? profile.status
        : statusFromProvider;
      return {
        ...profile,
        providerLabel: provider.label,
        status,
        message: status === profile.status ? profile.message : provider.status.message,
        lastTestedAt: status === 'ready' ? provider.status.checkedAt : profile.lastTestedAt,
        lastValidatedAt: status === 'ready' ? provider.status.checkedAt : profile.lastValidatedAt,
      };
    });
  }, [providerAccountProfiles, providerProfiles, providers]);

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === settings?.selectedProviderId),
    [providers, settings?.selectedProviderId],
  );

  const selectedProviderProfile = useMemo(() => {
    if (!settings?.selectedProviderId) return undefined;
    const providerAccounts = effectiveProviderProfiles.filter(
      (profile) => profile.providerId === settings.selectedProviderId,
    );
    return (
      providerAccounts.find((profile) => profile.id === settings.selectedProviderProfileId) ??
      providerAccounts.find((profile) => profile.isDefault) ??
      providerAccounts[0]
    );
  }, [effectiveProviderProfiles, settings]);

  const selectedProviderStatus: ProviderRuntimeStatus | undefined = useMemo(
    () =>
      selectedProvider?.status ??
      (settings
        ? {
            state: 'unavailable',
            message: `Provider salvo \`${settings.selectedProviderId}\` não está registrado neste build.`,
            checkedAt: new Date().toISOString(),
          }
        : undefined),
    [selectedProvider, settings],
  );

  const activeModel = useMemo(() => {
    if (!selectedModelId && !settings?.selectedModelId) return undefined;
    return modelRegistry.byId(selectedModelId ?? settings?.selectedModelId ?? '');
  }, [selectedModelId, settings?.selectedModelId]);

  const activeModelLabel = useMemo(() => {
    if (executionMode === 'cloud' && selectedProviderStatus?.state !== 'ready') return 'Configurar modelos';
    if (executionMode === 'cloud' && selectedProviderProfile && selectedProviderProfile.status !== 'ready') return 'Configurar modelos';
    if (executionMode === 'local' && localRuntime?.state !== 'ready') return 'Configurar modelos locais';
    return activeModel?.displayName ?? settings?.selectedModelId ?? 'modelo não selecionado';
  }, [
    activeModel?.displayName,
    executionMode,
    localRuntime?.state,
    selectedProviderProfile,
    selectedProviderStatus?.state,
    settings?.selectedModelId,
  ]);

  const selectedModelDisplayLabel = useMemo(
    () => activeModel?.displayName ?? selectedModelId ?? settings?.selectedModelId ?? 'Selecionar modelo',
    [activeModel?.displayName, selectedModelId, settings?.selectedModelId],
  );

  const topbarCloudModels = useMemo<TopBarModelOption[]>(() => {
    return buildCloudModelOptions({
      providers,
      providerProfiles: effectiveProviderProfiles,
      localRuntime,
    });
  }, [effectiveProviderProfiles, localRuntime, providers]);

  const topbarLocalModels = useMemo<TopBarModelOption[]>(() => {
    return buildLocalModelOptions({
      localRuntime,
      providerStatus: selectedProviderStatus,
      installationProgress,
    });
  }, [installationProgress, localRuntime, selectedProviderStatus]);

  const orderDisabledReason = useMemo(() => {
    if (!settings) return 'Configurações não carregadas.';

    if (executionMode === 'local') {
      if (!localRuntime) return 'Runtime local ainda não carregado.';
      if (localRuntime.state !== 'ready') {
        const translated = translateError(localRuntime.problems[0] ?? localRuntime.state, localRuntime.message);
        return `${translated.message} ${translated.actionLabel ? `Ação: ${translated.actionLabel}.` : ''}`;
      }
      const localModelId = settings.selectedLocalModelId ?? settings.selectedModelId;
      if (!localModelId || !isLocalModelInstalled(localRuntime, localModelId)) {
        const translated = translateError('model_missing');
        return `${translated.message} ${translated.actionLabel}.`;
      }
      return undefined;
    }

    if (selectedProviderStatus && selectedProviderStatus.state !== 'ready') {
      const translated = translateError(selectedProviderStatus.state, selectedProviderStatus.message);
      return `${translated.message} ${translated.actionLabel ? `Ação: ${translated.actionLabel}.` : ''}`;
    }

    if (selectedProviderProfile && selectedProviderProfile.status !== 'ready') {
      return `${selectedProviderProfile.message} Ação: ajuste a conta em Configurações > Modelos.`;
    }

    return undefined;
  }, [executionMode, localRuntime, selectedProviderProfile, selectedProviderStatus, settings]);

  const workspacePath = (relativePath: string): string | undefined => {
    if (!settings?.workspaceRoot) return undefined;
    return `${settings.workspaceRoot.replace(/\/$/, '')}/${relativePath}`;
  };

  function pushToast(tone: ToastMessage['tone'], message: string): void {
    if (tone === 'success') return;
    setToasts((current) => [
      ...current,
      {
        id: `${Date.now()}-${current.length}`,
        tone,
        message,
      },
    ]);
  }

  function toggleSidebar(): void {
    setSidebarCollapsed((current) => {
      writeLocalStorage('codex-sidebar-collapsed', current ? 'false' : 'true');
      return !current;
    });
  }

  function openSettingsTab(tab: SettingsTab = 'general'): void {
    setSettingsTabRequest({ tab, nonce: Date.now() });
    setControlModalOpen(true);
  }

  function persistProjectSessionIds(next: Record<string, string[]>): void {
    writeLocalStorage('codex-command-center-project-sessions', JSON.stringify(next));
    setProjectSessionIds(next);
  }

  function resetProjectDialog(): void {
    setEditingProjectName(undefined);
    setProjectName('');
    setProjectInstructions('');
    setProjectMemoryScope('default');
    setProjectPreset(undefined);
    setProjectFiles([]);
    setProjectAdvancedOpen(false);
    setProjectMemoryMenuOpen(false);
  }

  function closeProjectDialog(): void {
    setProjectDialogOpen(false);
    setProjectFileManagerOpen(false);
    resetProjectDialog();
  }

  function openNewProjectDialog(): void {
    resetProjectDialog();
    setProjectDialogOpen(true);
  }

  function openEditProjectDialog(project: string): void {
    const meta = readProjectMeta(project);
    setEditingProjectName(project);
    setProjectName(meta?.title ?? project);
    setProjectInstructions(meta?.instructions ?? '');
    setProjectMemoryScope(meta?.memoryScope ?? 'default');
    setProjectPreset(meta?.presetId);
    setProjectFiles(meta?.files ?? []);
    setProjectAdvancedOpen(Boolean(meta?.instructions || meta?.memoryScope === 'project' || (meta?.files.length ?? 0) > 0));
    setProjectMemoryMenuOpen(false);
    setProjectDialogOpen(true);
  }

  function chooseProjectPreset(presetId: ProjectPresetId): void {
    const preset = PROJECT_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setProjectPreset(presetId);
    setProjectInstructions(preset.instructions);
  }

  function addProjectFile(attachment: SelectedFileAttachment): void {
    setProjectFiles((current) => [
      attachment.path,
      ...current.filter((path) => path !== attachment.path),
    ].slice(0, 12));
    pushToast('success', `Arquivo adicionado ao projeto: ${attachment.name}`);
  }

  function rememberProjectSession(project: string, sessionId: string): void {
    const current = projectSessionIds[project] ?? [];
    const next = {
      ...projectSessionIds,
      [project]: [sessionId, ...current.filter((id) => id !== sessionId)].slice(0, 60),
    };
    persistProjectSessionIds(next);
  }

  function forgetProjectSession(project: string, sessionId: string): void {
    const current = projectSessionIds[project] ?? [];
    const nextIds = current.filter((id) => id !== sessionId);
    const next = { ...projectSessionIds };
    if (nextIds.length > 0) {
      next[project] = nextIds;
    } else {
      delete next[project];
    }
    persistProjectSessionIds(next);
  }

  function saveProject(): void {
    const title = projectName.trim();
    if (!title) return;

    const renamed = editingProjectName && editingProjectName !== title;
    const nextProjects = Array.from(new Set([title, ...savedProjects.filter((project) => project !== editingProjectName && project !== title)])).slice(0, 24);
    const projectMeta: StoredProjectMeta = {
      title,
      instructions: projectInstructions.trim(),
      memoryScope: projectMemoryScope,
      presetId: projectPreset,
      files: projectFiles,
      updatedAt: new Date().toISOString(),
    };
    writeLocalStorage('codex-command-center-projects', JSON.stringify(nextProjects));
    writeLocalStorage(`codex-command-center-project:${title}`, JSON.stringify(projectMeta));
    if (renamed && editingProjectName) {
      removeLocalStorage(`codex-command-center-project:${editingProjectName}`);
      const nextSessionIds = { ...projectSessionIds };
      nextSessionIds[title] = nextSessionIds[editingProjectName] ?? [];
      delete nextSessionIds[editingProjectName];
      persistProjectSessionIds(nextSessionIds);
    }
    writeLocalStorage('codex-command-center-active-project', title);
    setSavedProjects(nextProjects);
    setActiveProject(title);
    selectSession(undefined);
    closeProjectDialog();
    pushToast('success', editingProjectName ? `Projeto atualizado: ${title}` : `Projeto criado: ${title}`);
  }

  function handleDeleteProject(project: string): void {
    if (!savedProjects.includes(project)) {
      pushToast('info', 'Projeto externo aparece via workspace ou memória e não foi removido daqui.');
      return;
    }
    const nextProjects = savedProjects.filter((item) => item !== project);
    const nextSessionIds = { ...projectSessionIds };
    delete nextSessionIds[project];
    writeLocalStorage('codex-command-center-projects', JSON.stringify(nextProjects));
    removeLocalStorage(`codex-command-center-project:${project}`);
    persistProjectSessionIds(nextSessionIds);
    setSavedProjects(nextProjects);
    if (activeProject === project) {
      setActiveProject(undefined);
      writeLocalStorage('codex-command-center-active-project', '');
    }
  }

  useEffect(() => {
    let mounted = true;
    const unlisteners: Array<() => void> = [];

    async function init(): Promise<void> {
      setLoading(true);
      try {
        const payload = await bootstrapState();
        if (!mounted) return;
        bootstrap(payload);
        applyAppTheme(payload.theme, payload.settings.themePreference ?? 'dark');
        const actionCatalog = await listPrivilegedActions();
        if (mounted) {
          setPrivilegedActions(actionCatalog);
        }
        const credentials = await listProviderCredentials();
        const accountProfiles = await listProviderProfiles();
        if (mounted) {
          setProviderCredentials(credentials);
          setProviderAccountProfiles(accountProfiles);
        }

        setLocalRuntimeLoading(true);
        const runtimeSnapshot = await getLocalRuntimeState();
        if (mounted) {
          setLocalRuntime(runtimeSnapshot);
          setLocalRuntimeLoading(false);
        }

        unlisteners.push(await onStatusNote((note) => appendStatus(note)));
        unlisteners.push(await onCommandLog((chunk) => appendLog(chunk)));
        unlisteners.push(await onFileChanged((change) => pushFileChange(change)));
        unlisteners.push(await onSessionChanged((session) => upsertSession(session)));
        unlisteners.push(await onPermissionRaised((request) => addPermission(request)));
        unlisteners.push(await onPermissionResolved((requestId) => removePermission(requestId)));
        unlisteners.push(await onPermissionOutcome((outcome) => recordPermissionOutcome(outcome)));
        unlisteners.push(
          await onLocalRuntimeState((snapshot) => {
            setLocalRuntime(snapshot);
          }),
        );
        unlisteners.push(
          await onLocalModelProgress((progress) => {
            setInstallationProgress((current) => ({
              ...current,
              [progress.modelId]: progress,
            }));
          }),
        );
      } catch (cause) {
        if (!mounted) return;
        setError(cause instanceof Error ? cause.message : 'Falha ao inicializar aplicação.');
      } finally {
        if (mounted) {
          setLoading(false);
          setLocalRuntimeLoading(false);
        }
      }
    }

    void init();

    return () => {
      mounted = false;
      for (const unlisten of unlisteners) {
        unlisten();
      }
    };
  }, [
    addPermission,
    appendLog,
    appendStatus,
    bootstrap,
    pushFileChange,
    recordPermissionOutcome,
    removePermission,
    setError,
    setLoading,
    upsertSession,
  ]);

  useEffect(() => {
    if (!theme) return undefined;

    const preference = settings?.themePreference ?? 'dark';
    const apply = (): void => {
      applyAppTheme(theme, preference);
    };

    apply();

    if (preference !== 'system' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const media = window.matchMedia('(prefers-color-scheme: light)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings?.themePreference, theme]);

  async function ensureSession(seed: string): Promise<string> {
    if (selectedSessionId) {
      return selectedSessionId;
    }
    const created = await createSession(titleFromContent(seed));
    upsertSession(created);
    selectSession(created.id);
    return created.id;
  }

  function handleCreateSession(): void {
    setTemporaryChatActive(false);
    setTemporaryMessages([]);
    if (!activeProject) {
      writeLocalStorage('codex-command-center-active-project', '');
    }
    selectSession(undefined);
  }

  function handleSelectProject(project: string): void {
    setTemporaryChatActive(false);
    setTemporaryMessages([]);
    setActiveProject(project);
    writeLocalStorage('codex-command-center-active-project', project);
    selectSession(undefined);
  }

  function handleSelectSession(sessionId?: string): void {
    setTemporaryChatActive(false);
    setTemporaryMessages([]);
    setActiveProject(undefined);
    writeLocalStorage('codex-command-center-active-project', '');
    selectSession(sessionId);
  }

  function startTemporaryChat(): void {
    setTemporaryChatActive(true);
    setTemporaryMessages([]);
    setActiveProject(undefined);
    writeLocalStorage('codex-command-center-active-project', '');
    selectSession(undefined);
  }

  function exitTemporaryChat(): void {
    setTemporaryChatActive(false);
    setTemporaryMessages([]);
  }

  async function handleSendPrompt(prompt: string, mode: InputModeId = 'auto', attachments: ChatAttachment[] = []): Promise<void> {
    const cleaned = trimMultiline(prompt);
    if (!cleaned && attachments.length === 0) return;
    const visibleContent = cleaned || 'Anexo enviado.';
    const outgoingAttachments = [...attachments];

    if (!temporaryChatActive && activeProject) {
      const meta = readProjectMeta(activeProject);
      const projectMemory = buildProjectMemoryAttachment(
        activeProject,
        meta?.memoryScope === 'project' ? meta.instructions : undefined,
      );
      if (projectMemory) outgoingAttachments.push(projectMemory);
    }

    if (temporaryChatActive) {
      const userMessage: ChatMessage = {
        id: `temporary-user-${Date.now()}-${temporaryMessages.length}`,
        role: 'user',
        content: visibleContent,
        createdAt: new Date().toISOString(),
        attachments: outgoingAttachments,
      };
      const previousMessages = temporaryMessages;
      setTemporaryMessages([...previousMessages, userMessage]);
      setBusy(true);
      try {
        const session = await sendTemporaryOrderToAgent(previousMessages, visibleContent, mode, outgoingAttachments);
        setTemporaryMessages(session.messages);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Falha ao executar Bate-papo Temporário.';
        const assistantError: ChatMessage = {
          id: `temporary-error-${Date.now()}`,
          role: 'assistant',
          content: `Erro no Bate-papo Temporário\n${message}`,
          createdAt: new Date().toISOString(),
          reasoningSummary: 'Falha controlada do provider; nenhuma resposta simulada foi usada.',
        };
        setTemporaryMessages([...previousMessages, userMessage, assistantError]);
      } finally {
        setBusy(false);
      }
      return;
    }

    let sessionId: string | undefined;
    const optimisticUserMessage = createOptimisticUserMessage(visibleContent, outgoingAttachments);
    setBusy(true);
    try {
      sessionId = await ensureSession(visibleContent);
      const session = useAppStore.getState().sessions.find((item) => item.id === sessionId);
      if (session && !session.messages.some((message) => message.id === optimisticUserMessage.id)) {
        upsertSession({
          ...session,
          status: 'executing',
          updatedAt: optimisticUserMessage.createdAt,
          messages: [...session.messages, optimisticUserMessage],
        });
      }
      if (activeProject) {
        rememberProjectSession(activeProject, sessionId);
      }
      const updated = await sendOrderToAgent(sessionId, visibleContent, mode, outgoingAttachments);
      if (activeProject) {
        const assistantText = [...updated.messages].reverse().find((message) => message.role === 'assistant')?.content ?? '';
        if (assistantText.trim()) updateProjectMemoryFromExchange(activeProject, visibleContent, assistantText);
      }
      upsertSession(updated);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Falha ao enviar mensagem ao provider.';
      if (sessionId) {
        const session = useAppStore.getState().sessions.find((item) => item.id === sessionId);
        if (session) {
          const assistantError: ChatMessage = {
            id: `provider-error-${Date.now()}`,
            role: 'assistant',
            content: `Erro do provider\n${message}`,
            createdAt: new Date().toISOString(),
            reasoningSummary: 'Falha controlada do provider; nenhuma resposta simulada foi usada.',
          };
          upsertSession({
            ...session,
            status: 'error',
            updatedAt: assistantError.createdAt,
            messages: [...session.messages, assistantError],
          });
        }
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleExecuteCommand(command: string): Promise<void> {
    const cleaned = trimMultiline(command);
    if (!cleaned) return;
    setBusy(true);
    try {
      const sessionId = await ensureSession(cleaned);
      const response = await requestExecution({
        sessionId,
        command: cleaned,
        cwd: settings?.workspaceRoot,
        reason: 'Comando solicitado pelo usuário na central.',
      });
      if (response.permissionRequest) {
        addPermission(response.permissionRequest);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestPrivilegedAction(actionId: string, args: Record<string, unknown>, dryRun: boolean): Promise<void> {
    setBusy(true);
    try {
      const sessionId = await ensureSession(actionId);
      const request = await requestPrivilegedAction({
        sessionId,
        actionId,
        args,
        reason: 'Ação privilegiada solicitada pelo usuário no painel de permissões.',
        dryRun,
      });
      addPermission(request);
    } finally {
      setBusy(false);
    }
  }

  async function applySettings(next: AppSettings): Promise<void> {
    const updated = await updateSettings(next);
    syncSettings(updated);
  }

  async function handleUpdateSettings(next: AppSettings): Promise<void> {
    let normalized = next;
    if (next.selectedProviderId === 'local-ollama') {
      normalized = {
        ...next,
        executionMode: 'local',
        selectedLocalModelId: next.selectedModelId,
      };
    } else if (next.executionMode === 'local') {
      normalized = {
        ...next,
        executionMode: 'cloud',
      };
    }
    await applySettings(normalized);
  }

  function openEnvironmentTab(tab: EnvironmentTab = 'ready'): void {
    void tab;
    openSettingsTab('models');
  }

  async function handleTestProvider(providerId: string): Promise<ProviderRuntimeStatus> {
    const status = await testProviderConnection(providerId);
    updateProviderStatus(providerId, status);
    await refreshProviderCredentials();
    return status;
  }

  async function refreshProviderCredentials(): Promise<void> {
    const credentials = await listProviderCredentials();
    const accountProfiles = await listProviderProfiles();
    setProviderCredentials(credentials);
    setProviderAccountProfiles(accountProfiles);
  }

  async function handleSaveProviderProfileCredential(
    providerId: string,
    profileId: string | undefined,
    name: string,
    key: string,
    makeDefault: boolean,
  ): Promise<ProviderAccountProfile> {
    const profile = await saveProviderProfileCredential(providerId, profileId, name, key, makeDefault);
    updateProviderStatus(providerId, {
      state: 'testing',
      message: `${profile.providerLabel || providerId} recebeu API key; teste a conexão antes de selecionar.`,
      checkedAt: new Date().toISOString(),
    });
    await refreshProviderCredentials();
    return profile;
  }

  async function handleSetDefaultProviderProfile(providerId: string, profileId: string): Promise<void> {
    await setDefaultProviderProfile(providerId, profileId);
    await refreshProviderCredentials();
  }

  async function handleRenameProviderProfile(profileId: string, name: string): Promise<void> {
    await renameProviderProfile(profileId, name);
    await refreshProviderCredentials();
  }

  async function handleRemoveProviderProfile(profileId: string): Promise<void> {
    await removeProviderProfile(profileId);
    await refreshProviderCredentials();
  }

  async function handleRunCheckEnvironment(): Promise<void> {
    const scriptPath = workspacePath('scripts/check-environment.sh');
    if (!settings?.workspaceRoot || !scriptPath) {
      setError('Workspace ainda não carregado para rodar check-environment.');
      return;
    }

    setBusy(true);
    try {
      const sessionId = await ensureSession('Check environment');
      const response = await requestExecution({
        sessionId,
        command: `bash ${shellQuote(scriptPath)}`,
        cwd: settings.workspaceRoot,
        reason: 'Checklist de ambiente acionado pelo painel Primeiros Passos.',
      });
      if (response.permissionRequest) {
        addPermission(response.permissionRequest);
      }
    } finally {
      setBusy(false);
    }
  }

  function cloudEnvironmentInput(model: CloudModelProfile): EnvironmentSelectionInput | undefined {
    if (!settings) return undefined;
    const provider = providers.find((item) => item.id === model.providerId);
    if (!provider) {
      setError(`Provider ${model.providerLabel} não está registrado neste build.`);
      return undefined;
    }
    const status = resolveModelStatus(model, provider.status, localRuntime);
    if (!canSelectModel(status)) {
      setError(translateError(status, provider.status.message).message);
      openEnvironmentTab('configure');
      return undefined;
    }
    const providerAccounts = effectiveProviderProfiles.filter((profile) => profile.providerId === model.providerId);
    const readyProfile =
      providerAccounts.find((profile) => profile.isDefault && profile.status === 'ready') ??
      providerAccounts.find((profile) => profile.status === 'ready');
    if (providerAccounts.length > 0 && !readyProfile) {
      setError('Nenhum profile pronto para este provider. Configure ou teste a conta antes de selecionar.');
      openEnvironmentTab('accounts');
      return undefined;
    }
    return {
      providerId: model.providerId,
      modelId: model.modelId,
      agentProfileId: safeAgentProfileId(settings.selectedAgentId),
      accountProfileId: readyProfile?.id ?? settings.selectedProviderProfileId,
    };
  }

  function localEnvironmentInput(model: LocalModelProfile): EnvironmentSelectionInput | undefined {
    if (!settings) return undefined;
    const status = resolveModelStatus(model, selectedProviderStatus, localRuntime);
    if (!canSelectModel(status)) {
      setError(translateError(status, localRuntime?.message).message);
      openEnvironmentTab('local');
      return undefined;
    }
    return {
      providerId: 'local-ollama',
      modelId: model.modelId,
      agentProfileId: safeAgentProfileId(settings.selectedAgentId),
      accountProfileId: undefined,
    };
  }

  async function handleSetGlobalCloud(model: CloudModelProfile): Promise<void> {
    const input = cloudEnvironmentInput(model);
    if (!settings || !input) return;
    setModelActionBusyId(model.id);
    try {
      const next = pushHistory(
        {
          ...settings,
          executionMode: 'cloud',
          selectedProviderId: input.providerId,
          selectedModelId: input.modelId,
          selectedProviderProfileId: input.accountProfileId,
        },
        'cloud',
        input.providerId,
        input.modelId,
      );
      await applySettings(next);
      setExecutionMode('cloud');
      selectModel(model.id);
      pushToast('success', `Padrão global definido: ${model.displayName}`);
    } finally {
      setModelActionBusyId(undefined);
    }
  }

  async function handleSetGlobalLocal(model: LocalModelProfile): Promise<void> {
    const input = localEnvironmentInput(model);
    if (!settings || !input) return;
    setModelActionBusyId(model.id);
    try {
      const next = pushHistory(
        {
          ...settings,
          executionMode: 'local',
          selectedProviderId: 'local-ollama',
          selectedModelId: input.modelId,
          selectedLocalModelId: input.modelId,
        },
        'local',
        'local-ollama',
        input.modelId,
      );
      await applySettings(next);
      setExecutionMode('local');
      selectModel(model.id);
      pushToast('success', `Padrão global local definido: ${model.displayName}`);
    } finally {
      setModelActionBusyId(undefined);
    }
  }

  async function refreshLocalRuntime(): Promise<void> {
    const snapshot = await getLocalRuntimeState();
    setLocalRuntime(snapshot);
  }

  async function handleInstallLocalModel(model: LocalModelProfile): Promise<void> {
    if (!settings) return;
    setModelActionBusyId(model.id);
    try {
      const snapshot = await installLocalModel(model.modelId);
      const refreshed = await getLocalRuntimeState().catch(() => snapshot);
      setLocalRuntime(refreshed);
      if (!isLocalModelInstalled(refreshed, model.modelId)) {
        throw new Error(`Ollama terminou o download, mas ${model.modelId} ainda não aparece em /api/tags ou ollama list.`);
      }
      const next = pushHistory(
        {
          ...settings,
          executionMode: 'local',
          selectedProviderId: 'local-ollama',
          selectedModelId: model.modelId,
          selectedLocalModelId: model.modelId,
        },
        'local',
        'local-ollama',
        model.modelId,
      );
      await applySettings(next);
      setExecutionMode('local');
      selectModel(model.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao instalar modelo local.');
      await refreshLocalRuntime();
    } finally {
      setModelActionBusyId(undefined);
    }
  }

  async function handleRemoveLocalModelById(modelId: string): Promise<void> {
    if (!settings) return;
    setModelActionBusyId(modelId);
    try {
      const snapshot = await removeLocalModel(modelId);
      setLocalRuntime(snapshot);
      const removedSelected =
        normalizeOllamaModelId(settings.selectedLocalModelId ?? '') === normalizeOllamaModelId(modelId) ||
        normalizeOllamaModelId(settings.selectedModelId ?? '') === normalizeOllamaModelId(modelId);
      if (removedSelected) {
        const nextInstalled = snapshot.installedModels[0]?.id;
        await applySettings({
          ...settings,
          selectedModelId: settings.executionMode === 'local' ? nextInstalled ?? '' : settings.selectedModelId,
          selectedLocalModelId: nextInstalled,
        });
        if (nextInstalled) selectModel(nextInstalled);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao remover modelo local.');
      await refreshLocalRuntime();
    } finally {
      setModelActionBusyId(undefined);
    }
  }

  async function handleRenameSession(session: AgentSession, title: string): Promise<void> {
    const nextTitle = title.trim();
    if (!nextTitle || nextTitle === session.title) return;
    const updated = await renameSession(session.id, nextTitle);
    upsertSession(updated);
  }

  async function handleDeleteSession(session: AgentSession): Promise<void> {
    await deleteSession(session.id);
    removeSession(session.id);
    setArchivedSessions((current) => current.filter((item) => item.id !== session.id));
    if (sessionInfoId === session.id) {
      setSessionInfoId(undefined);
    }
    setDeleteSessionTarget(undefined);
  }

  async function refreshArchivedSessions(): Promise<void> {
    setArchivedLoading(true);
    setArchivedError(undefined);
    try {
      const archived = await listArchivedSessions();
      setArchivedSessions(archived);
    } catch (cause) {
      setArchivedError(cause instanceof Error ? cause.message : 'Falha ao listar conversas arquivadas.');
    } finally {
      setArchivedLoading(false);
    }
  }

  function openArchivedConversations(): void {
    setArchivedModalOpen(true);
    void refreshArchivedSessions();
  }

  async function handleArchiveSession(session: AgentSession): Promise<void> {
    const archived = await archiveSession(session.id);
    upsertSession(archived);
    setArchivedSessions((current) => [archived, ...current.filter((item) => item.id !== archived.id)]);
    if (selectedSessionId === session.id) {
      selectSession(undefined);
    }
  }

  async function handleRestoreArchivedSession(session: AgentSession): Promise<void> {
    const restored = await restoreSession(session.id);
    setArchivedSessions((current) => current.filter((item) => item.id !== session.id));
    upsertSession(restored);
    selectSession(restored.id);
  }

  async function handleDeleteArchivedSession(session: AgentSession): Promise<void> {
    await deleteSession(session.id);
    setArchivedSessions((current) => current.filter((item) => item.id !== session.id));
    removeSession(session.id);
  }

  async function handleDuplicateSession(session: AgentSession): Promise<void> {
    const duplicated = await duplicateSession(session.id);
    upsertSession(duplicated);
    selectSession(duplicated.id);
    if (activeProject) {
      rememberProjectSession(activeProject, duplicated.id);
    }
  }

  async function handleExportSession(session: AgentSession, format: 'markdown' | 'json' | 'txt'): Promise<void> {
    const result = await exportSession(session.id, format);
    setExportSessionTarget(undefined);
    pushToast('success', `Sessão exportada: ${result.path}`);
  }

  async function handleExportAllConversations(): Promise<string> {
    const result = await exportAllConversations();
    return result.path;
  }

  async function handleImportConversations(path: string): Promise<string> {
    const result = await importConversations(path);
    for (const session of result.sessions) {
      upsertSession(session);
    }
    return `Importadas: ${result.imported}${result.reassignedIds > 0 ? ` · IDs recriados: ${result.reassignedIds}` : ''}${result.skipped > 0 ? ` · ignoradas: ${result.skipped}` : ''}`;
  }

  async function handleArchiveAllConversations(): Promise<void> {
    const visibleSessions = await archiveAllSessions();
    replaceSessions(visibleSessions, undefined);
    selectSession(undefined);
  }

  async function handleDeleteAllConversations(): Promise<void> {
    await deleteAllSessions();
    replaceSessions([], undefined);
    selectSession(undefined);
  }

  function handleSessionMenuAction(session: AgentSession, action: 'pin' | 'archive' | 'share' | 'move-to-project' | 'remove-from-project'): void {
    if (action === 'pin') {
      pushToast('info', 'Pino será conectado na próxima etapa.');
      return;
    }
    if (action === 'archive') {
      void handleArchiveSession(session).catch((cause) => {
        setError(cause instanceof Error ? cause.message : 'Falha ao arquivar conversa.');
      });
      return;
    }
    if (action === 'share') {
      pushToast('info', 'Compartilhamento será conectado na próxima etapa.');
      return;
    }
    if (action === 'move-to-project') {
      if (!activeProject) {
        pushToast('info', 'Selecione um projeto antes de mover a conversa.');
        return;
      }
      rememberProjectSession(activeProject, session.id);
      pushToast('success', `Conversa movida para ${activeProject}.`);
      return;
    }
    if (!activeProject) {
      pushToast('info', 'Abra o projeto para remover a conversa dele.');
      return;
    }
    forgetProjectSession(activeProject, session.id);
    pushToast('success', `Conversa removida de ${activeProject}.`);
  }

  function handleOpenGuide(): void {
    const path = workspacePath('docs/GUIA_DE_USO.md');
    if (path) void openFileInVscode(path);
  }

  function handleOpenQuickstart(): void {
    const path = workspacePath('docs/QUICKSTART.md');
    if (path) void openFileInVscode(path);
  }

  function handleOpenWorkspace(): void {
    if (settings?.workspaceRoot) void openProjectInVscode(settings.workspaceRoot);
  }

  function handleOpenCodexRoot(): void {
    if (settings?.codexRoot) void openProjectInVscode(settings.codexRoot);
  }

  function handleOpenLogs(): void {
    if (settings?.codexRoot) void openProjectInVscode(`${settings.codexRoot}/codex-ui/logs`);
  }

  async function handleSetTopbarCloudOption(option: TopBarModelOption): Promise<void> {
    if (!settings || !option.providerId || !option.available) return;
    const providerAccounts = effectiveProviderProfiles.filter((profile) => profile.providerId === option.providerId);
    const readyProfile =
      providerAccounts.find((profile) => profile.isDefault && profile.status === 'ready') ??
      providerAccounts.find((profile) => profile.status === 'ready');
    if (providerAccounts.length > 0 && !readyProfile) {
      setError('Nenhum profile pronto para este provider. Configure ou teste a conta antes de selecionar.');
      openEnvironmentTab('accounts');
      return;
    }
    const selectedModel = option.modelId ?? option.id;
    setModelActionBusyId(option.id);
    try {
      const next = pushHistory(
        {
          ...settings,
          executionMode: 'cloud',
          selectedProviderId: option.providerId,
          selectedModelId: selectedModel,
          selectedProviderProfileId: readyProfile?.id ?? settings.selectedProviderProfileId,
        },
        'cloud',
        option.providerId,
        selectedModel,
      );
      await applySettings(next);
      setExecutionMode('cloud');
      selectModel(option.id);
      pushToast('success', `Padrão global definido: ${option.label}`);
    } finally {
      setModelActionBusyId(undefined);
    }
  }

  async function handleSetTopbarLocalOption(option: TopBarModelOption): Promise<void> {
    if (!settings || !option.available) return;
    const selectedModel = option.modelId ?? option.id;
    setModelActionBusyId(option.id);
    try {
      const next = pushHistory(
        {
          ...settings,
          executionMode: 'local',
          selectedProviderId: 'local-ollama',
          selectedModelId: selectedModel,
          selectedLocalModelId: selectedModel,
        },
        'local',
        'local-ollama',
        selectedModel,
      );
      await applySettings(next);
      setExecutionMode('local');
      selectModel(option.id);
      pushToast('success', `Padrão global local definido: ${option.label}`);
    } finally {
      setModelActionBusyId(undefined);
    }
  }

  function handleTopbarSelectModel(mode: ExecutionMode, modelId: string): void {
    const model = modelRegistry.byId(modelId);
    if (mode === 'local' && model?.mode === 'local') {
      void handleSetGlobalLocal(model);
      return;
    }
    if (mode === 'cloud' && model?.mode === 'cloud') {
      void handleSetGlobalCloud(model);
      return;
    }
    const option = (mode === 'cloud' ? topbarCloudModels : topbarLocalModels)
      .find((item) => item.id === modelId || item.modelId === modelId);
    if (!option) return;
    if (mode === 'cloud') {
      void handleSetTopbarCloudOption(option);
      return;
    }
    void handleSetTopbarLocalOption(option);
  }

  async function handleInstallLocalModelById(modelId: string): Promise<void> {
    const model = modelRegistry.byId(modelId);
    if (model?.mode === 'local') {
      await handleInstallLocalModel(model);
      return;
    }
    const option = topbarLocalModels.find((item) => item.id === modelId || item.modelId === modelId);
    const catalogModel = option?.modelId ? modelRegistry.byId(option.modelId) : undefined;
    if (catalogModel?.mode === 'local') {
      await handleInstallLocalModel(catalogModel);
      return;
    }

    const targetModelId = option?.modelId ?? modelId.replace(/^ollama-(?:pull|download):/u, '');
    if (!settings || !targetModelId) return;
    setModelActionBusyId(option?.id ?? targetModelId);
    try {
      const snapshot = await installLocalModel(targetModelId);
      const refreshed = await getLocalRuntimeState().catch(() => snapshot);
      setLocalRuntime(refreshed);
      if (!isLocalModelInstalled(refreshed, targetModelId)) {
        throw new Error(`Ollama terminou o download, mas ${targetModelId} ainda não aparece em /api/tags ou ollama list.`);
      }
      const next = pushHistory(
        {
          ...settings,
          executionMode: 'local',
          selectedProviderId: 'local-ollama',
          selectedModelId: targetModelId,
          selectedLocalModelId: targetModelId,
        },
        'local',
        'local-ollama',
        targetModelId,
      );
      await applySettings(next);
      setExecutionMode('local');
      selectModel(targetModelId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao instalar modelo local.');
      await refreshLocalRuntime();
      throw cause;
    } finally {
      setModelActionBusyId(undefined);
    }
  }

  async function handleTestLocalModelById(modelId: string): Promise<boolean> {
    const snapshot = await startLocalRuntime();
    setLocalRuntime(snapshot);
    return snapshot.state === 'ready' && isLocalModelInstalled(snapshot, modelId);
  }

  if (loading) return <div className="centered" style={{ height: '100vh' }}>Inicializando central...</div>;
  if (error && !booted) return <div className="centered error" style={{ height: '100vh' }}>{error}</div>;

  const activeChatSession = temporarySession ?? selectedSession;
  const activeChatResponding = busy && Boolean(activeChatSession?.messages.at(-1)?.role === 'user');
  const projectWorkspaceOpen = Boolean(activeProject && !selectedSession && !temporaryChatActive);
  const selectedProjectMemoryOption = PROJECT_MEMORY_OPTIONS.find((option) => option.id === projectMemoryScope) ?? PROJECT_MEMORY_OPTIONS[0];
  const commandInput = (
    <CommandInputPanel
      key={temporaryChatActive ? 'temporary-composer' : activeProject ? `project-${activeProject}` : 'regular-composer'}
      busy={busy}
      privilegedActions={privilegedActions}
      onSendOrder={handleSendPrompt}
      onExecuteCommand={handleExecuteCommand}
      onRequestPrivilegedAction={handleRequestPrivilegedAction}
      actionJsonExamples={actionJsonExamples}
      orderDisabledReason={orderDisabledReason}
      executionMode={executionMode}
      activeModelLabel={activeModelLabel}
      providerLabel={selectedProviderStatus?.state === 'ready' ? selectedProvider?.label : 'Configurar'}
      runtimeState={executionMode === 'local' ? localRuntime?.state : undefined}
      onOpenModelSelector={() => openEnvironmentTab('ready')}
      onOpenTerminal={() => setTerminalOpen(true)}
    />
  );

  return (
    <>
      <AppShell
        sidebarLeft={
          <SessionsPanel
            sessions={sessions}
            projects={sidebarProjects}
            projectSessions={projectSessionsByName}
            activeProject={activeProject}
            selectedSessionId={selectedSessionId}
            onNewSession={handleCreateSession}
            onNewProject={openNewProjectDialog}
            onEditProject={openEditProjectDialog}
            onDeleteProject={handleDeleteProject}
            onSelectProject={handleSelectProject}
            onToggleSidebar={toggleSidebar}
            onSelect={handleSelectSession}
            onRename={(session, title) => void handleRenameSession(session, title)}
            onDelete={(session) => setDeleteSessionTarget(session)}
            onExport={(session, format) => void handleExportSession(session, format)}
            onDuplicate={(session) => void handleDuplicateSession(session)}
            onSessionMenuAction={handleSessionMenuAction}
            onOpenSettings={openSettingsTab}
            onOpenArchivedConversations={openArchivedConversations}
            onCloseSession={() => {
              handleSelectSession(undefined);
              setControlModalOpen(false);
              pushToast('info', 'Saída da conta será conectada quando houver auth real.');
            }}
            collapsed={sidebarCollapsed}
          />
        }
        main={
          <div className={`main-workspace ${activeChatSession || projectWorkspaceOpen ? '' : 'main-workspace-home'} ${projectWorkspaceOpen ? 'main-workspace-project' : ''} ${temporaryChatActive ? 'main-workspace-temporary' : ''}`}>
            <TopBar
              providerStatus={selectedProviderStatus}
              executionMode={executionMode}
              activeModelLabel={activeModelLabel}
              selectedModelLabel={selectedModelDisplayLabel}
              selectedModelId={activeModel?.id ?? selectedModelId ?? settings?.selectedModelId}
              cloudModels={topbarCloudModels}
              localModels={topbarLocalModels}
              localRuntime={localRuntime}
              credentials={providerCredentials}
              providerProfiles={effectiveProviderProfiles}
              installationProgress={installationProgress}
              busyModelId={modelActionBusyId}
              temporaryChatActive={temporaryChatActive}
              onSelectModel={handleTopbarSelectModel}
              onConfigureModels={() => openEnvironmentTab('ready')}
              onSaveProviderProfileCredential={handleSaveProviderProfileCredential}
              onSetDefaultProviderProfile={handleSetDefaultProviderProfile}
              onRenameProviderProfile={handleRenameProviderProfile}
              onRemoveProviderProfile={handleRemoveProviderProfile}
              onTestProvider={handleTestProvider}
              onInstallLocalModel={handleInstallLocalModelById}
              onRemoveLocalModel={handleRemoveLocalModelById}
              onTestLocalModel={handleTestLocalModelById}
              onStartTemporaryChat={startTemporaryChat}
              onExitTemporaryChat={exitTemporaryChat}
            />
            {error ? (
              <div className="actionable-error-banner" role="alert">
                <strong>{translateError(error).message}</strong>
                <button type="button" className="btn-modern" onClick={() => { setError(undefined); openEnvironmentTab('ready'); }}>
                  Modelos
                </button>
              </div>
            ) : null}
            {temporaryChatActive ? (
              <>
                {temporaryMessages.length === 0 ? (
                  <section className="temporary-chat-view" aria-label="Bate-papo Temporário">
                    <h1>Bate-papo Temporário</h1>
                    <p>Esta conversa não aparecerá no histórico e as suas mensagens não serão guardadas.</p>
                  </section>
                ) : (
                  <ChatPanel session={temporarySession} emptyTitle="Bate-papo Temporário" onOpenEnvironment={() => openEnvironmentTab('ready')} isResponding={activeChatResponding} />
                )}
                {commandInput}
              </>
            ) : projectWorkspaceOpen && activeProject ? (
              <section className="project-workspace-view">
                <div className="project-workspace-inner">
                  <header className="project-workspace-header">
                    <ProjectFolderIcon />
                    <h1>{activeProject}</h1>
                  </header>
                  {commandInput}
                  <section className="project-conversation-section" aria-label={`Conversas do projeto ${activeProject}`}>
                    <h2>Conversas</h2>
                    {activeProjectConversations.length > 0 ? (
                      <div className="project-conversation-list">
                        {activeProjectConversations.map((session) => (
                          <article key={session.id} className={`project-conversation-row ${selectedSessionId === session.id ? 'active' : ''}`}>
                            <button type="button" onClick={() => handleSelectSession(session.id)}>
                              <span>{session.title}</span>
                              <small>Hoje</small>
                            </button>
                            <div className="popup-anchor project-conversation-menu-anchor">
                              <button
                                type="button"
                                className="project-conversation-more"
                                aria-label={`Ações da conversa ${session.title}`}
                                onClick={() => setProjectConversationMenuId((current) => current === session.id ? undefined : session.id)}
                              >
                                ⋯
                              </button>
                              <PopupMenu open={projectConversationMenuId === session.id} onClose={() => setProjectConversationMenuId(undefined)}>
                                <button type="button" onClick={() => { setProjectConversationMenuId(undefined); handleSessionMenuAction(session, 'pin'); }}>
                                  <UiIcon name="pin" className="menu-icon" />
                                  Pino
                                </button>
                                <button type="button" onClick={() => { setProjectConversationMenuId(undefined); pushToast('info', 'Renomeie a conversa pela sidebar por enquanto.'); }}>
                                  <UiIcon name="edit" className="menu-icon" />
                                  Renomear
                                </button>
                                <button type="button" onClick={() => { setProjectConversationMenuId(undefined); void handleDuplicateSession(session); }}>
                                  <UiIcon name="copy" className="menu-icon" />
                                  Clonar
                                </button>
                                <button type="button" onClick={() => { setProjectConversationMenuId(undefined); handleSessionMenuAction(session, 'archive'); }}>
                                  <UiIcon name="archive" className="menu-icon" />
                                  Arquivo
                                </button>
                                <button type="button" onClick={() => { setProjectConversationMenuId(undefined); handleSessionMenuAction(session, 'share'); }}>
                                  <UiIcon name="send" className="menu-icon" />
                                  Compartilhar
                                </button>
                                <button type="button" onClick={() => { setProjectConversationMenuId(undefined); void handleExportSession(session, 'markdown'); }}>
                                  <UiIcon name="download" className="menu-icon" />
                                  Baixar
                                </button>
                                <button type="button" onClick={() => { setProjectConversationMenuId(undefined); handleSessionMenuAction(session, 'move-to-project'); }}>
                                  <UiIcon name="moveToProject" className="menu-icon" />
                                  Mover para Projeto
                                </button>
                                <button type="button" onClick={() => { setProjectConversationMenuId(undefined); handleSessionMenuAction(session, 'remove-from-project'); }}>
                                  <UiIcon name="moveFromProject" className="menu-icon" />
                                  Mover do Projeto
                                </button>
                                <button type="button" className="danger" onClick={() => { setProjectConversationMenuId(undefined); setDeleteSessionTarget(session); }}>
                                  <UiIcon name="trash" className="menu-icon" />
                                  Excluir
                                </button>
                              </PopupMenu>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="project-empty-conversations">
                        <strong>Nenhuma conversa neste projeto</strong>
                        <span>Envie uma mensagem pelo composer para criar a primeira conversa vinculada.</span>
                      </div>
                    )}
                  </section>
                </div>
              </section>
            ) : (
              <>
                <ChatPanel session={selectedSession} emptyTitle="O que gostaria de explorar?" onOpenEnvironment={() => openEnvironmentTab('accounts')} isResponding={activeChatResponding} />
                {commandInput}
              </>
            )}
            {terminalOpen ? <TerminalDrawer logs={logs} open={terminalOpen} onToggle={() => setTerminalOpen((current) => !current)} /> : null}
          </div>
        }
        sidebarRightVisible={false}
        sidebarLeftCollapsed={sidebarCollapsed}
        sidebarRight={null}
      />

      <PremiumModal
        open={controlModalOpen}
        title="Configurações"
        description="Preferências do app em uma superfície limpa, sem diagnóstico técnico na frente."
        onClose={() => setControlModalOpen(false)}
        className="control-modal"
      >
        <SettingsPanel
          key={settingsTabRequest?.nonce ?? 'settings-modal-panel'}
          settings={settings}
          providers={providers}
          profiles={profiles}
          localRuntime={localRuntime}
          sessions={sessions}
          onChange={(next) => handleUpdateSettings(next)}
          onExportConversations={handleExportAllConversations}
          onImportConversations={handleImportConversations}
          onArchiveAllConversations={handleArchiveAllConversations}
          onDeleteAllConversations={handleDeleteAllConversations}
          initialTab={settingsTabRequest?.tab ?? 'general'}
        />
      </PremiumModal>

      <ArchivedConversationsModal
        open={archivedModalOpen}
        sessions={archivedSessions}
        loading={archivedLoading}
        error={archivedError}
        onClose={() => setArchivedModalOpen(false)}
        onRefresh={refreshArchivedSessions}
        onRestore={handleRestoreArchivedSession}
        onDelete={handleDeleteArchivedSession}
      />

      <HelpDrawer
        open={helpOpen}
        busy={busy || localRuntimeLoading}
        onClose={() => setHelpOpen(false)}
        onOpenGuide={handleOpenGuide}
        onOpenQuickstart={handleOpenQuickstart}
        onOpenWorkspace={handleOpenWorkspace}
        onOpenCodexRoot={handleOpenCodexRoot}
        onOpenLogs={handleOpenLogs}
        onRunCheckEnvironment={() => void handleRunCheckEnvironment()}
      />

      <ConfirmDialog
        open={Boolean(deleteSessionTarget)}
        title="Excluir sessão?"
        message="Essa ação remove a sessão salva. Não afeta outros projetos."
        confirmLabel="Excluir"
        danger
        onCancel={() => setDeleteSessionTarget(undefined)}
        onConfirm={() => {
          if (deleteSessionTarget) void handleDeleteSession(deleteSessionTarget);
        }}
      />

      <ExportDialog
        open={Boolean(exportSessionTarget)}
        title={exportSessionTarget?.title ?? ''}
        onCancel={() => setExportSessionTarget(undefined)}
        onExport={(format) => {
          if (exportSessionTarget) void handleExportSession(exportSessionTarget, format);
        }}
      />

      <PremiumModal
        open={projectDialogOpen}
        title={editingProjectName ? 'Editar Projeto' : 'Novo Projeto'}
        onClose={closeProjectDialog}
        className="project-modal"
      >
        <div className="project-dialog project-dialog-simple">
          <div className="project-name-row">
            <span className="project-plus-mark" aria-hidden="true">
              <UiIcon name="folderPlus" />
            </span>
            <input
              value={projectName}
              placeholder="Nome do Projeto"
              onChange={(event) => setProjectName(event.target.value)}
            />
          </div>

          <div className="project-preset-row" aria-label="Pré-configurações">
            {PROJECT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={projectPreset === preset.id ? 'active' : ''}
                onClick={() => chooseProjectPreset(preset.id)}
              >
                <UiIcon name={preset.icon} className="project-preset-icon" />
                {preset.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="project-advanced-toggle"
            onClick={() => setProjectAdvancedOpen((current) => !current)}
            aria-expanded={projectAdvancedOpen}
          >
            Configurações Avançadas <span aria-hidden="true">{projectAdvancedOpen ? '⌄' : '›'}</span>
          </button>

          {projectAdvancedOpen ? (
            <div className="project-advanced-panel">
              <div className="project-memory-row">
                <span>
                  Memória
                  <small aria-hidden="true">i</small>
                </span>
                <div className="popup-anchor">
                  <button
                    type="button"
                    className="project-memory-select"
                    onClick={() => setProjectMemoryMenuOpen((current) => !current)}
                  >
                    {selectedProjectMemoryOption.label} <span aria-hidden="true">{projectMemoryMenuOpen ? '⌃' : '⌄'}</span>
                  </button>
                  <PopupMenu open={projectMemoryMenuOpen} onClose={() => setProjectMemoryMenuOpen(false)} placement="auto">
                    {PROJECT_MEMORY_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={projectMemoryScope === option.id ? 'active' : ''}
                        onClick={() => {
                          setProjectMemoryScope(option.id);
                          setProjectMemoryMenuOpen(false);
                        }}
                      >
                        <span className="project-memory-option">
                          <strong>{option.label}</strong>
                          <small>{option.description}</small>
                        </span>
                      </button>
                    ))}
                  </PopupMenu>
                </div>
              </div>

              <label className="project-advanced-field">
                <span>
                  Instruções
                  <small aria-hidden="true">i</small>
                </span>
                <textarea
                  value={projectInstructions}
                  maxLength={1000}
                  placeholder="O que deverá a IA saber sobre este projeto? (por exemplo, regras específicas, tom ou formatação)"
                  onChange={(event) => setProjectInstructions(event.target.value)}
                />
                <small>{projectInstructions.length} / 1000</small>
              </label>

              <div className="project-files-row">
                <span>
                  Arquivos
                  <small aria-hidden="true">i</small>
                </span>
                <button type="button" className="btn-modern project-file-button" onClick={() => setProjectFileManagerOpen(true)}>
                  <UiIcon name="paperclip" className="menu-icon" />
                  Adicionar Arquivos
                </button>
              </div>
              {projectFiles.length > 0 ? (
                <div className="project-file-list">
                  {projectFiles.map((file) => <span key={file}>{file}</span>)}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="project-dialog-footer">
            <button type="button" className="btn-modern btn-modern-primary" disabled={!projectName.trim()} onClick={saveProject}>
              {editingProjectName ? 'Salvar projeto' : 'Criar projeto'}
            </button>
          </div>
        </div>
      </PremiumModal>

      <FileManagerModal
        open={projectFileManagerOpen}
        onClose={() => setProjectFileManagerOpen(false)}
        onSelect={(attachment) => {
          addProjectFile(attachment);
          setProjectFileManagerOpen(false);
        }}
      />

      <ToastViewport
        toasts={toasts}
        onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))}
      />

      <PremiumModal
        open={Boolean(sessionInfo)}
        title="Informações da sessão"
        description={sessionInfo?.title}
        onClose={() => setSessionInfoId(undefined)}
        className="compact-modal"
      >
        {sessionInfo ? (
          <section className="session-info-dialog session-info-dialog-compact">
            <div className="session-info-grid">
              <span>Nome: <strong>{sessionInfo.title}</strong></span>
              <span>Criada: <strong>{new Date(sessionInfo.createdAt).toLocaleString('pt-BR')}</strong></span>
              <span>Atualizada: <strong>{new Date(sessionInfo.updatedAt).toLocaleString('pt-BR')}</strong></span>
              <span>Mensagens: <strong>{sessionInfo.messages.length}</strong></span>
              <span>Tipo: <strong>{(sessionInfo.providerId ?? settings?.selectedProviderId) === 'local-ollama' ? 'Local' : 'Nuvem'}</strong></span>
              <span>Provider: <strong>{sessionInfo.providerId ?? settings?.selectedProviderId ?? 'não definido'}</strong></span>
              <span>Modelo: <strong>{sessionInfo.modelId ?? settings?.selectedModelId ?? 'não definido'}</strong></span>
              <span>Modo atual: <strong>{safeAgentProfileId(sessionInfo.agentProfileId ?? settings?.selectedAgentId)}</strong></span>
            </div>
            <details className="model-details session-info-details">
              <summary>Detalhes técnicos</summary>
              <p>ID: {sessionInfo.id}</p>
              <p>Status: {sessionInfo.status.replace('_', ' ')}</p>
              <p>Conta: {sessionInfo.accountProfileId ?? settings?.selectedProviderProfileId ?? 'não definida'}</p>
            </details>
          </section>
        ) : null}
      </PremiumModal>
    </>
  );
}
