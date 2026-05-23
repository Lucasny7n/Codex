import { useRuntimeStore } from '../../stores/runtimeStore';
import { useModelStore } from '../../stores/modelStore';
import { RuntimeStatus } from './runtimeTypes';

export function getRuntimeStatus(): RuntimeStatus {
  const { runtime } = useRuntimeStore.getState();
  const { primaryModelId, fallbackModelId } = useModelStore.getState();

  const isInstalled = !!runtime?.airllm_installed;
  
  // No V4, ainda não temos carregamento de modelo real, então vamos simular honestamente
  // se o AirLLM não está instalado, não está ready.
  return {
    installed: isInstalled,
    ready: isInstalled,
    selectedModelId: primaryModelId || fallbackModelId || null,
    loadedModelId: null, // Motor real ainda não carregou modelo
    fallbackActive: !isInstalled
  };
}

export function canGenerate(): boolean {
  const status = getRuntimeStatus();
  // Só podemos gerar se estiver ready e com modelo carregado (ou em modo mock/fallback por enquanto)
  return status.ready && status.loadedModelId !== null;
}
