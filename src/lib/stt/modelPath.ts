const STT_MODEL_STORAGE_KEY = 'codex-command-center-stt-model-path';

export function readStoredSttModelPath(): string {
  try {
    return window.localStorage?.getItem(STT_MODEL_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function writeStoredSttModelPath(path: string): void {
  try {
    if (path.trim()) {
      window.localStorage?.setItem(STT_MODEL_STORAGE_KEY, path.trim());
    } else {
      window.localStorage?.removeItem(STT_MODEL_STORAGE_KEY);
    }
  } catch {
    // A configuração local de STT também funciona em memória se localStorage falhar.
  }
}
