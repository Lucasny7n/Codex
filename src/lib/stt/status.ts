import type { LocalSttConfigSnapshot, VoiceTranscriptionResult } from '../../types/domain';

export type SttStatusLevel = 'ok' | 'warning' | 'error';
export type SttCaptureStatus = 'not_tested' | 'ok' | 'warning' | 'denied' | 'error';

export interface NormalizedSttState {
  backend: SttStatusLevel;
  model: SttStatusLevel;
  webviewCapture: SttCaptureStatus;
  nativeCapture: SttCaptureStatus;
  ready: boolean;
  backendLabel: string;
  modelLabel: string;
  summary: string;
}

const FALSE_BACKEND_PATTERNS = [
  /backend local não configurado/iu,
  /modelo whisper não encontrado/iu,
  /sudo\s+pacman\s+-S\s+(?:--needed\s+)?ffmpeg\s+whisper\.cpp/iu,
  /configurar transcrição local:\s*.*whisper\.cpp/iu,
];

export function captureStatusFromSnapshot(status?: 'ok' | 'warning' | 'error'): SttCaptureStatus {
  if (status === 'ok') return 'ok';
  if (status === 'warning') return 'warning';
  if (status === 'error') return 'error';
  return 'not_tested';
}

export function normalizeSttSnapshot(snapshot: LocalSttConfigSnapshot | undefined): NormalizedSttState {
  if (!snapshot) {
    return {
      backend: 'warning',
      model: 'warning',
      webviewCapture: 'not_tested',
      nativeCapture: 'not_tested',
      ready: false,
      backendLabel: 'Não testada',
      modelLabel: 'Não testado',
      summary: 'Abra a detecção para configurar.',
    };
  }

  const backend: SttStatusLevel = snapshot.ready ? 'ok' : !snapshot.ffmpeg.installed ? 'error' : 'warning';
  const model: SttStatusLevel = snapshot.modelExists ? 'ok' : 'warning';
  return {
    backend,
    model,
    webviewCapture: captureStatusFromSnapshot(snapshot.capture.webviewStatus),
    nativeCapture: captureStatusFromSnapshot(snapshot.capture.nativeStatus),
    ready: snapshot.ready,
    backendLabel: backend === 'ok' ? 'OK' : backend === 'error' ? 'Erro' : 'Atenção',
    modelLabel: model === 'ok' ? 'OK' : 'Atenção',
    summary: snapshot.message,
  };
}

export function isFalseSttBackendMessage(message: string | undefined): boolean {
  if (!message) return false;
  return FALSE_BACKEND_PATTERNS.some((pattern) => pattern.test(message));
}

export function shouldTreatMissingBackendAsTranscriptionError(
  result: VoiceTranscriptionResult,
  snapshot: LocalSttConfigSnapshot | undefined,
): boolean {
  return result.status === 'missing_backend' && snapshot?.ready === true;
}

export function sttFailureMessage(
  result: VoiceTranscriptionResult,
  snapshot: LocalSttConfigSnapshot | undefined,
): string {
  if (shouldTreatMissingBackendAsTranscriptionError(result, snapshot)) {
    return 'Captei o áudio, mas não consegui transcrever.';
  }

  if (result.status === 'missing_backend') {
    if (snapshot?.modelExists === false) {
      return 'Modelo de transcrição local não encontrado. Selecione um arquivo em ~/.codex/models.';
    }
    return 'Transcrição local indisponível. Verifique ffmpeg, whisper-cli e o modelo local.';
  }

  const message = result.message.trim();
  if (/nenhuma fala|no speech|empty transcript|sem fala/iu.test(message)) {
    return 'Nenhuma fala foi reconhecida. Tente falar mais perto do microfone.';
  }

  return 'Captei o áudio, mas não consegui transcrever.';
}
