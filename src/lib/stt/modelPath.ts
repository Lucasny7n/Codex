const STT_MODEL_STORAGE_KEY = 'ailu-ai-studio-stt-model-path';
const LEGACY_STT_MODEL_STORAGE_KEY = 'codex-command-center-stt-model-path';

export function readStoredSttModelPath(): string {
  try {
    const current = window.localStorage?.getItem(STT_MODEL_STORAGE_KEY);
    if (current !== null && current !== undefined) return current;
    const legacy = window.localStorage?.getItem(LEGACY_STT_MODEL_STORAGE_KEY) ?? '';
    if (legacy) {
      window.localStorage?.setItem(STT_MODEL_STORAGE_KEY, legacy);
      window.localStorage?.removeItem(LEGACY_STT_MODEL_STORAGE_KEY);
    }
    return legacy;
  } catch {
    return '';
  }
}

export function writeStoredSttModelPath(path: string): void {
  try {
    if (path.trim()) {
      window.localStorage?.setItem(STT_MODEL_STORAGE_KEY, path.trim());
      window.localStorage?.removeItem(LEGACY_STT_MODEL_STORAGE_KEY);
    } else {
      window.localStorage?.removeItem(STT_MODEL_STORAGE_KEY);
      window.localStorage?.removeItem(LEGACY_STT_MODEL_STORAGE_KEY);
    }
  } catch {
    // A configuração local de STT também funciona em memória se localStorage falhar.
  }
}
