import { create } from 'zustand';
import type {
  AgentProfile,
  AgentSession,
  AppSettings,
  CommandLogChunk,
  ExecutionMode,
  FileChangeEntry,
  MemorySnapshot,
  PermissionOutcome,
  PermissionRequest,
  ProviderAccountProfile,
  ProviderDescriptor,
  ProviderRuntimeStatus,
  StatusNote,
  SystemTheme,
  WorkspaceMeta,
} from '../types/domain';

interface AppStoreState {
  booted: boolean;
  loading: boolean;
  error?: string;
  settings?: AppSettings;
  workspaceMeta?: WorkspaceMeta;
  providers: ProviderDescriptor[];
  providerProfiles: ProviderAccountProfile[];
  profiles: AgentProfile[];
  memory?: MemorySnapshot;
  theme?: SystemTheme;
  sessions: AgentSession[];
  selectedSessionId?: string;
  logs: CommandLogChunk[];
  changedFiles: FileChangeEntry[];
  statusFeed: StatusNote[];
  pendingPermissions: PermissionRequest[];
  permissionOutcomes: PermissionOutcome[];
  selectedModelId?: string;
  executionMode: ExecutionMode;
  modelSelectorOpen: boolean;
  setLoading: (value: boolean) => void;
  setError: (value?: string) => void;
  bootstrap: (payload: {
    settings: AppSettings;
    workspaceMeta: WorkspaceMeta;
    sessions: AgentSession[];
    pendingPermissions: PermissionRequest[];
    providers: ProviderDescriptor[];
    providerProfiles: ProviderAccountProfile[];
    agentProfiles: AgentProfile[];
    memory: MemorySnapshot;
    theme: SystemTheme;
  }) => void;
  upsertSession: (session: AgentSession) => void;
  removeSession: (sessionId: string) => void;
  selectSession: (sessionId?: string) => void;
  appendLog: (chunk: CommandLogChunk) => void;
  appendStatus: (status: StatusNote) => void;
  pushFileChange: (change: FileChangeEntry) => void;
  addPermission: (request: PermissionRequest) => void;
  removePermission: (requestId: string) => void;
  recordPermissionOutcome: (outcome: PermissionOutcome) => void;
  updateSettings: (settings: AppSettings) => void;
  updateProviderStatus: (providerId: string, status: ProviderRuntimeStatus) => void;
  selectModel: (modelId: string) => void;
  setExecutionMode: (mode: ExecutionMode) => void;
  setModelSelectorOpen: (open: boolean) => void;
}

function dedupeByPath(changes: FileChangeEntry[]): FileChangeEntry[] {
  const seen = new Map<string, FileChangeEntry>();
  for (const item of changes) {
    seen.set(item.path, item);
  }
  return Array.from(seen.values()).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 200);
}

function resolveActiveModelId(settings: AppSettings): string {
  if (settings.executionMode === 'local') {
    return settings.selectedLocalModelId ?? settings.selectedModelId;
  }
  return settings.selectedModelId;
}

export const useAppStore = create<AppStoreState>((set, get) => ({
  booted: false,
  loading: true,
  providers: [],
  providerProfiles: [],
  profiles: [],
  sessions: [],
  logs: [],
  changedFiles: [],
  statusFeed: [],
  pendingPermissions: [],
  permissionOutcomes: [],
  selectedModelId: undefined,
  executionMode: 'cloud',
  modelSelectorOpen: false,
  setLoading: (value) => set({ loading: value }),
  setError: (value) => set({ error: value }),
  bootstrap: (payload) =>
    set({
      booted: true,
      loading: false,
      error: undefined,
      settings: payload.settings,
      workspaceMeta: payload.workspaceMeta,
      sessions: payload.sessions,
      selectedSessionId: undefined,
      pendingPermissions: payload.pendingPermissions,
      providers: payload.providers,
      providerProfiles: payload.providerProfiles,
      profiles: payload.agentProfiles,
      memory: payload.memory,
      theme: payload.theme,
      executionMode: payload.settings.executionMode,
      selectedModelId: resolveActiveModelId(payload.settings),
    }),
  upsertSession: (session) => {
    const current = get().sessions;
    const index = current.findIndex((candidate) => candidate.id === session.id);
    if (index === -1) {
      set({
        sessions: [session, ...current].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        selectedSessionId: get().selectedSessionId ?? session.id,
      });
      return;
    }
    const next = [...current];
    next[index] = session;
    next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    set({ sessions: next });
  },
  removeSession: (sessionId) => {
    const next = get().sessions.filter((session) => session.id !== sessionId);
    set({
      sessions: next,
      selectedSessionId: get().selectedSessionId === sessionId ? undefined : get().selectedSessionId,
    });
  },
  selectSession: (sessionId) => set({ selectedSessionId: sessionId }),
  appendLog: (chunk) => set({ logs: [...get().logs, chunk].slice(-2500) }),
  appendStatus: (status) => set({ statusFeed: [status, ...get().statusFeed].slice(0, 500) }),
  pushFileChange: (change) => {
    const next = dedupeByPath([change, ...get().changedFiles]);
    set({ changedFiles: next });
  },
  addPermission: (request) => {
    const existing = get().pendingPermissions;
    if (existing.some((entry) => entry.id === request.id)) {
      return;
    }
    set({ pendingPermissions: [request, ...existing] });
  },
  removePermission: (requestId) => {
    set({ pendingPermissions: get().pendingPermissions.filter((entry) => entry.id !== requestId) });
  },
  recordPermissionOutcome: (outcome) => {
    set({ permissionOutcomes: [outcome, ...get().permissionOutcomes].slice(0, 100) });
  },
  updateSettings: (settings) =>
    set({
      settings,
      executionMode: settings.executionMode,
      selectedModelId: resolveActiveModelId(settings),
    }),
  updateProviderStatus: (providerId, status) =>
    set({
      providers: get().providers.map((provider) =>
        provider.id === providerId
          ? {
              ...provider,
              enabled: status.state === 'ready',
              status,
            }
          : provider,
      ),
    }),
  selectModel: (modelId) => set({ selectedModelId: modelId }),
  setExecutionMode: (mode) => set({ executionMode: mode }),
  setModelSelectorOpen: (open) => set({ modelSelectorOpen: open }),
}));
