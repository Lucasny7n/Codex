import { useRuntimeStore } from '../../stores/runtimeStore';
import { useModelStore } from '../../stores/modelStore';
import { RuntimeStatus } from './runtimeTypes';

export function getRuntimeStatus(): RuntimeStatus {
  // O estado no V5 é buscado de forma honesta, sem mock.
  const { status } = useRuntimeStore.getState();
  const { primaryModelId, fallbackModelId } = useModelStore.getState();

  // Em versões reais, nós só definimos selectedModelId baseando na store.
  // E o loadedModelId continuará nulo até chamarmos "generateText" ou uma API de load dedicada.
  return {
    ...status,
    selectedModelId: primaryModelId || fallbackModelId || null,
  };
}

export function canGenerate(): boolean {
  const status = getRuntimeStatus();
  // V5: só permite gerar via runtime se estiver instalado e "ready" e não estiver em fallback
  return status.installed && status.ready && !status.fallbackActive;
}
