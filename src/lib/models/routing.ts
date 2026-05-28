/**
 * Simple, deterministic model router. Maps a composer task mode to a concrete
 * provider/model using the available models plus the user's routing preference.
 * Pure and fully testable — no IA, no network. Always returns a choice (falling
 * back to the configured default) so sending a message never breaks.
 */

export type TaskMode = 'auto' | 'thinking' | 'fast' | 'code' | 'terminal';

export interface RoutableModel {
  providerId: string;
  modelId: string;
  mode: 'local' | 'cloud';
  /** 1–5 quality/speed signals (from the model registry). */
  codeQuality?: number;
  reasoningQuality?: number;
  speed?: number;
  available: boolean;
}

export interface RoutingResolverInput {
  mode: TaskMode;
  /** Prefer an available local model over cloud when possible. */
  localPreferred?: boolean;
  /** The user's currently-selected model (the default). */
  defaultModel?: { providerId: string; modelId: string };
  availableLocalModels: RoutableModel[];
  availableCloudModels: RoutableModel[];
}

export interface ResolvedModel {
  provider: string;
  model: string;
  reason: string;
  fallbackUsed: boolean;
}

function scoreFor(mode: TaskMode, model: RoutableModel): number {
  switch (mode) {
    case 'code':
      return model.codeQuality ?? 0;
    case 'thinking':
      return model.reasoningQuality ?? 0;
    case 'fast':
      return model.speed ?? 0;
    default:
      return 0;
  }
}

/** Best available model for the mode, honoring localPreferred as a tie/priority. */
function pickBest(
  mode: TaskMode,
  localPreferred: boolean,
  available: RoutableModel[],
): RoutableModel | undefined {
  if (available.length === 0) return undefined;
  return [...available].sort((a, b) => {
    if (localPreferred && a.mode !== b.mode) {
      return a.mode === 'local' ? -1 : 1;
    }
    const scoreDiff = scoreFor(mode, b) - scoreFor(mode, a);
    if (scoreDiff !== 0) return scoreDiff;
    // Stable-ish: prefer local on an exact tie even without localPreferred.
    if (a.mode !== b.mode) return a.mode === 'local' ? -1 : 1;
    return 0;
  })[0];
}

const MODE_LABEL: Record<TaskMode, string> = {
  auto: 'Automático',
  thinking: 'Pensamento',
  fast: 'Rápido',
  code: 'Código',
  terminal: 'Terminal',
};

export function resolveModelForTask(input: RoutingResolverInput): ResolvedModel {
  const { mode, localPreferred = false, defaultModel } = input;
  const available = [...input.availableLocalModels, ...input.availableCloudModels].filter((m) => m.available);

  const defaultAvailable = defaultModel
    ? available.find((m) => m.providerId === defaultModel.providerId && m.modelId === defaultModel.modelId)
    : undefined;

  // Auto / Terminal stick to the configured default when it is available.
  // (Terminal is about approval, not a special model.)
  if (mode === 'auto' || mode === 'terminal') {
    if (defaultAvailable) {
      return {
        provider: defaultAvailable.providerId,
        model: defaultAvailable.modelId,
        reason: mode === 'terminal'
          ? 'Modo Terminal usa o modelo padrão; ações sensíveis ainda exigem aprovação.'
          : 'Modo Automático usa o modelo padrão.',
        fallbackUsed: false,
      };
    }
    // Default missing/unavailable → fall back to the best available.
    const best = localPreferred
      ? pickBest(mode, true, available)
      : available[0];
    if (best) {
      return {
        provider: best.providerId,
        model: best.modelId,
        reason: 'Modelo padrão indisponível; usando um modelo disponível como fallback.',
        fallbackUsed: true,
      };
    }
    return fallbackToDefault(defaultModel, 'Nenhum modelo disponível; mantendo o padrão configurado.');
  }

  // Task modes: pick the best-scoring available model for the task.
  const best = pickBest(mode, localPreferred, available);
  if (!best) {
    return fallbackToDefault(defaultModel, `Nenhum modelo disponível para o modo ${MODE_LABEL[mode]}; mantendo o padrão.`);
  }

  // Did we have to substitute because localPreferred local wasn't available?
  const localExists = available.some((m) => m.mode === 'local');
  const fellBackToCloud = localPreferred && !localExists && best.mode === 'cloud';

  let reason = `Modo ${MODE_LABEL[mode]} usa o modelo configurado para a tarefa.`;
  if (fellBackToCloud) {
    reason = `Nenhum modelo local disponível; usando nuvem para o modo ${MODE_LABEL[mode]}.`;
  } else if (localPreferred && best.mode === 'local') {
    reason = `Local preferido: usando modelo local para o modo ${MODE_LABEL[mode]}.`;
  }

  return {
    provider: best.providerId,
    model: best.modelId,
    reason,
    fallbackUsed: fellBackToCloud,
  };
}

function fallbackToDefault(
  defaultModel: { providerId: string; modelId: string } | undefined,
  reason: string,
): ResolvedModel {
  return {
    provider: defaultModel?.providerId ?? '',
    model: defaultModel?.modelId ?? '',
    reason,
    fallbackUsed: true,
  };
}
