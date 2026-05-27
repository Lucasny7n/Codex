import { useEffect, useRef, useState } from 'react';
import { getSttConfigState, recordAndTranscribeShortTest, transcribeAudio } from '../../lib/api';
import { readStoredSttModelPath, writeStoredSttModelPath } from '../../lib/stt/modelPath';
import {
  isFalseSttBackendMessage,
  normalizeSttSnapshot,
  shouldTreatMissingBackendAsTranscriptionError,
  sttFailureMessage,
  type SttCaptureStatus,
} from '../../lib/stt/status';
import type { ChatAttachment, LocalSttConfigSnapshot, SelectedFileAttachment, VoiceTranscriptionResult } from '../../types/domain';
import { UiIcon, type UiIconName } from '../common/AppIcons';
import { FileManagerModal } from '../file/FileManagerModal';
import { fileIconNameForKind, formatFileSize } from '../file/fileDisplay';
import { PopupMenu, PremiumModal, StatusDot } from '../common/PremiumUI';

interface CommandInputPanelProps {
  busy: boolean;
  onSendOrder: (order: string, mode: InputModeId, attachments: ChatAttachment[]) => Promise<void>;
  orderDisabledReason?: string;
  onOpenSkills?: () => void;
  onToast?: (tone: 'success' | 'error' | 'info', message: string) => void;
}

export type InputModeId = 'auto' | 'thinking' | 'fast' | 'code' | 'terminal';

interface InputModeOption {
  id: InputModeId;
  label: string;
  icon: 'spark' | 'book' | 'send' | 'fileCode' | 'desktop';
  description: string;
}

const INPUT_MODES: InputModeOption[] = [
  {
    id: 'auto',
    label: 'Automático',
    icon: 'spark',
    description: 'O app escolhe o melhor comportamento.',
  },
  {
    id: 'thinking',
    label: 'Pensamento',
    icon: 'book',
    description: 'Mais análise antes de responder.',
  },
  {
    id: 'fast',
    label: 'Rápido',
    icon: 'send',
    description: 'Resposta curta e direta.',
  },
  {
    id: 'code',
    label: 'Código',
    icon: 'fileCode',
    description: 'Foco em código, comandos e implementação.',
  },
  {
    id: 'terminal',
    label: 'Terminal',
    icon: 'desktop',
    description: 'Planeja comandos com aprovação para risco.',
  },
];

// Planned "+" menu actions not yet wired to a real backend. Shown disabled
// with an "em breve" badge so we never pretend they work.
const PLUS_SOON_ITEMS: Array<{ label: string; icon: UiIconName }> = [
  { label: 'Captura de tela', icon: 'image' },
  { label: 'Adicionar ao projeto', icon: 'folderPlus' },
  { label: 'Adicionar do GitHub', icon: 'globe' },
  { label: 'Conectores', icon: 'desktop' },
  { label: 'Pesquisa', icon: 'search' },
  { label: 'Busca na web', icon: 'globe' },
  { label: 'Estilo', icon: 'pen' },
  { label: 'Ferramentas', icon: 'fileCode' },
];

type VoiceState =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'done'
  | 'error'
  | 'missing-backend'
  | 'permission-denied';

type CaptureStatus = SttCaptureStatus;

const NATIVE_CAPTURE_FAILURE_MESSAGE = 'Não consegui gravar áudio pelo fallback nativo. Verifique o dispositivo de entrada.';

function captureStatusLabel(status: CaptureStatus, webview = false): string {
  if (status === 'ok') return 'OK';
  if (status === 'warning') return 'Atenção';
  if (status === 'denied') return webview ? 'Negada' : 'Erro';
  if (status === 'error') return 'Erro';
  return 'Não testada';
}

function captureStatusTone(status: CaptureStatus): 'ready' | 'warning' | 'error' | 'offline' {
  if (status === 'ok') return 'ready';
  if (status === 'warning') return 'warning';
  if (status === 'denied' || status === 'error') return 'error';
  return 'offline';
}

function sttBackendTone(snapshot: LocalSttConfigSnapshot | undefined): 'ready' | 'warning' | 'error' | 'offline' {
  if (!snapshot) return 'offline';
  const backend = normalizeSttSnapshot(snapshot).backend;
  if (backend === 'ok') return 'ready';
  if (backend === 'error') return 'error';
  return 'warning';
}

function sttBackendLabel(snapshot: LocalSttConfigSnapshot | undefined): string {
  return normalizeSttSnapshot(snapshot).backendLabel;
}

function sttModelTone(snapshot: LocalSttConfigSnapshot | undefined): 'ready' | 'warning' | 'error' | 'offline' {
  if (!snapshot) return 'offline';
  return normalizeSttSnapshot(snapshot).model === 'ok' ? 'ready' : 'warning';
}

function isCapturePermissionIssue(cause: unknown): boolean {
  if (cause instanceof DOMException) {
    return [
      'NotAllowedError',
      'PermissionDeniedError',
      'AbortError',
      'SecurityError',
      'NotReadableError',
      'NotFoundError',
      'DevicesNotFoundError',
    ].includes(cause.name);
  }
  const message = cause instanceof Error ? cause.message.toLowerCase() : String(cause ?? '').toLowerCase();
  return /permission|denied|notallowed|abort|portal|mediadevices|capture|microphone|device/u.test(message);
}

function cleanInlineErrorMessage(message: string | undefined, fallback: string): string {
  const firstUsefulLine = (message ?? '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !/^(stack trace|payload|traceback|at\s)/iu.test(line));
  if (!firstUsefulLine) return fallback;
  if (/^[{[]/u.test(firstUsefulLine) || /"stack"|"trace"|panic|backtrace/iu.test(firstUsefulLine)) {
    return fallback;
  }
  return firstUsefulLine.length > 180 ? `${firstUsefulLine.slice(0, 177)}...` : firstUsefulLine;
}

function mimeTypeForAttachment(attachment: SelectedFileAttachment): string | undefined {
  const extension = attachment.extension?.toLowerCase();
  if (attachment.kind === 'text') return 'text/plain';
  if (attachment.kind === 'json') return 'application/json';
  if (attachment.kind === 'pdf') return 'application/pdf';
  if (attachment.kind === 'zip') return 'application/zip';
  if (attachment.kind === 'image') {
    if (extension === 'svg') return 'image/svg+xml';
    return extension ? `image/${extension === 'jpg' ? 'jpeg' : extension}` : 'image/*';
  }
  if (attachment.kind === 'audio') return extension ? `audio/${extension}` : 'audio/*';
  if (attachment.kind === 'video') return extension ? `video/${extension}` : 'video/*';
  if (attachment.kind === 'code') return 'text/plain';
  return undefined;
}

const ATTACHMENT_CONTEXT_LIMIT = 8000;
const ATTACHMENT_PREVIEW_LIMIT = 1200;
const TEXTUAL_ATTACHMENT_KINDS = new Set(['text', 'json', 'code']);

function toChatAttachment(attachment: SelectedFileAttachment): ChatAttachment {
  const raw = attachment.preview;
  const previewAvailable = Boolean(raw);
  // Short text shown in the expandable chip.
  const previewTextLimited = raw
    ? raw.length <= ATTACHMENT_PREVIEW_LIMIT
      ? raw
      : `${raw.slice(0, ATTACHMENT_PREVIEW_LIMIT)}\n[mostrando início — conteúdo completo enviado ao modelo]`
    : undefined;
  // Readable text actually included in the model context, so the model can
  // answer about the file and the chip can honestly show "incluído".
  const isTextual = TEXTUAL_ATTACHMENT_KINDS.has(attachment.kind) || attachment.previewKind === 'text';
  const contextText = raw && isTextual
    ? raw.length <= ATTACHMENT_CONTEXT_LIMIT
      ? raw
      : `${raw.slice(0, ATTACHMENT_CONTEXT_LIMIT)}\n[conteúdo truncado em ${ATTACHMENT_CONTEXT_LIMIT} caracteres]`
    : undefined;
  return {
    path: attachment.path,
    name: attachment.name,
    mimeType: mimeTypeForAttachment(attachment),
    size: attachment.size,
    kind: attachment.kind,
    previewAvailable,
    previewTextLimited,
    contextText,
  };
}

export function CommandInputPanel({
  busy,
  onSendOrder,
  orderDisabledReason,
  onOpenSkills,
  onToast,
}: CommandInputPanelProps): JSX.Element {
  const [mode, setMode] = useState<InputModeId>('auto');
  const [prompt, setPrompt] = useState('');
  const [plusOpen, setPlusOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [fileManagerOpen, setFileManagerOpen] = useState(false);
  const [attachments, setAttachments] = useState<SelectedFileAttachment[]>([]);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceMessage, setVoiceMessage] = useState<string>();
  const [sttSetupOpen, setSttSetupOpen] = useState(false);
  const [sttSnapshot, setSttSnapshot] = useState<LocalSttConfigSnapshot>();
  const [sttModelPath, setSttModelPath] = useState(readStoredSttModelPath);
  const [sttSetupLoading, setSttSetupLoading] = useState(false);
  const [sttSetupError, setSttSetupError] = useState<string>();
  const [sttMicMessage, setSttMicMessage] = useState<string>();
  const [sttRecognizedText, setSttRecognizedText] = useState<string>();
  const [webViewCaptureStatus, setWebViewCaptureStatus] = useState<CaptureStatus>('not_tested');
  const [nativeCaptureStatus, setNativeCaptureStatus] = useState<CaptureStatus>('not_tested');
  const [sttTestRecording, setSttTestRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder>();
  const recordingStreamRef = useRef<MediaStream>();
  const recordedChunksRef = useRef<Blob[]>([]);
  const lastVoiceToastRef = useRef<VoiceState>('idle');

  const selectedMode = INPUT_MODES.find((item) => item.id === mode) ?? INPUT_MODES[0];
  const canSubmit =
    !busy &&
    (prompt.trim().length > 0 || attachments.length > 0) &&
    !orderDisabledReason;

  function stopRecordingTracks(): void {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = undefined;
  }

  useEffect(() => () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    stopRecordingTracks();
  }, []);

  // Voice errors surface as a discreet toast, not a persistent red banner under
  // the composer. Fires once per transition into a failure state.
  useEffect(() => {
    const failed = voiceState === 'error' || voiceState === 'missing-backend' || voiceState === 'permission-denied';
    if (failed && lastVoiceToastRef.current !== voiceState) {
      const tone = voiceState === 'missing-backend' ? 'info' : 'error';
      onToast?.(tone, voiceMessage ?? 'Entrada por voz indisponível neste ambiente.');
    }
    lastVoiceToastRef.current = voiceState;
  }, [voiceState, voiceMessage, onToast]);

  function applySttSnapshot(snapshot: LocalSttConfigSnapshot, path = sttModelPath): void {
    const normalized = normalizeSttSnapshot(snapshot);
    setSttSnapshot(snapshot);
    setWebViewCaptureStatus(normalized.webviewCapture);
    setNativeCaptureStatus(normalized.nativeCapture);
    if (!path.trim() && snapshot.modelPath) {
      setSttModelPath(snapshot.modelPath);
    }
    if (snapshot.ready) {
      setSttSetupError(undefined);
      setVoiceMessage((current) => isFalseSttBackendMessage(current) ? undefined : current);
      setVoiceState((current) => current === 'missing-backend' ? 'idle' : current);
    }
  }

  async function refreshSttConfig(path = sttModelPath): Promise<LocalSttConfigSnapshot | undefined> {
    setSttSetupLoading(true);
    setSttSetupError(undefined);
    try {
      const snapshot = await getSttConfigState(path.trim() || undefined);
      applySttSnapshot(snapshot, path);
      return snapshot;
    } catch (cause) {
      setSttSetupError(cleanInlineErrorMessage(cause instanceof Error ? cause.message : undefined, 'Falha ao detectar transcrição local.'));
      return undefined;
    } finally {
      setSttSetupLoading(false);
    }
  }

  function openSttSetup(): void {
    setSttSetupOpen(true);
    setSttSetupError(undefined);
    setSttMicMessage(undefined);
    setSttRecognizedText(undefined);
    void refreshSttConfig(sttModelPath);
  }

  async function saveSttModelPath(): Promise<void> {
    const path = sttModelPath.trim();
    writeStoredSttModelPath(path);
    await refreshSttConfig(path);
  }

  async function testMicrophone(): Promise<void> {
    await refreshSttConfig(sttModelPath);
    setSttMicMessage(undefined);
    if (!navigator.mediaDevices?.getUserMedia) {
      setWebViewCaptureStatus('denied');
      setSttMicMessage('Microfone indisponível no WebView atual.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setWebViewCaptureStatus('ok');
      setSttMicMessage('getUserMedia liberou acesso ao microfone. Grave um teste curto para validar a transcrição local.');
    } catch (cause) {
      const name = cause instanceof DOMException ? cause.name : '';
      setWebViewCaptureStatus(name === 'NotAllowedError' || isCapturePermissionIssue(cause) ? 'denied' : 'error');
      setSttMicMessage('Permissão WebView negada. Tentando captura nativa.');
      await runNativeCaptureFallback('Permissão WebView negada. Tentando captura nativa.');
    }
  }

  async function runNativeCaptureFallback(progressMessage = 'Tentando captura nativa curta...'): Promise<boolean> {
    const snapshot = await refreshSttConfig(sttModelPath);
    setNativeCaptureStatus((current) => current === 'ok' ? 'ok' : 'not_tested');
    setVoiceState('transcribing');
    setVoiceMessage(progressMessage);
    setSttMicMessage(progressMessage);
    try {
      const result = await recordAndTranscribeShortTest(sttModelPath.trim() || undefined);
      const captureOk = result.captureStatus === 'ok';
      const captureFailed = result.captureStatus === 'error';
      if (captureOk) setNativeCaptureStatus('ok');
      if (captureFailed) setNativeCaptureStatus('error');
      if (result.status === 'done' && result.text?.trim()) {
        appendTranscript(result.text);
        setSttRecognizedText(result.text);
        setNativeCaptureStatus('ok');
        setVoiceState('done');
        setVoiceMessage('Transcrição adicionada.');
        setSttMicMessage('Captura nativa funcionou e o texto foi reconhecido.');
        return true;
      }
      if (result.status === 'missing_backend') {
        if (!captureOk) setNativeCaptureStatus('warning');
        if (shouldTreatMissingBackendAsTranscriptionError(result, snapshot ?? sttSnapshot)) {
          const message = sttFailureMessage(result, snapshot ?? sttSnapshot);
          setVoiceState('error');
          setVoiceMessage(message);
          setSttMicMessage(message);
          return false;
        }
        const message = sttFailureMessage(result, snapshot ?? sttSnapshot);
        setVoiceState('missing-backend');
        setVoiceMessage(message);
        setSttMicMessage(captureOk
          ? 'Captura nativa funcionou, mas o backend STT ainda precisa ser configurado.'
          : 'Fallback nativo disponível, mas o backend STT ainda precisa ser configurado.');
        return false;
      }
      setVoiceState('error');
      if (captureOk) {
        const message = sttFailureMessage(result, snapshot ?? sttSnapshot);
        setVoiceMessage(message);
        setSttMicMessage(message);
      } else {
        setNativeCaptureStatus('error');
        setVoiceMessage(NATIVE_CAPTURE_FAILURE_MESSAGE);
        setSttMicMessage(NATIVE_CAPTURE_FAILURE_MESSAGE);
      }
      return false;
    } catch {
      setNativeCaptureStatus('error');
      setVoiceState('error');
      setVoiceMessage(NATIVE_CAPTURE_FAILURE_MESSAGE);
      setSttMicMessage(NATIVE_CAPTURE_FAILURE_MESSAGE);
      return false;
    }
  }

  async function recordShortSttTest(): Promise<void> {
    await refreshSttConfig(sttModelPath);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setWebViewCaptureStatus('denied');
      await runNativeCaptureFallback('Permissão WebView negada. Tentando captura nativa.');
      return;
    }
    setSttTestRecording(true);
    setSttMicMessage('Gravando teste curto...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
      ].find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      await new Promise<void>((resolve, reject) => {
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = () => reject(new Error('Falha durante a gravação do teste.'));
        recorder.onstop = () => resolve();
        recorder.start();
        window.setTimeout(() => {
          if (recorder.state !== 'inactive') recorder.stop();
        }, 1800);
      });
      stream.getTracks().forEach((track) => track.stop());
      setWebViewCaptureStatus('ok');
      setSttMicMessage('Transcrevendo teste...');
      const result = await transcribeBlob(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
      if (result?.status === 'done' && result.text?.trim()) {
        setSttRecognizedText(result.text);
        setSttMicMessage('Teste concluído. O texto reconhecido foi adicionado ao composer.');
      } else {
        setSttMicMessage('Teste concluído, mas nenhuma fala foi reconhecida.');
      }
    } catch (cause) {
      setWebViewCaptureStatus(isCapturePermissionIssue(cause) ? 'denied' : 'error');
      await runNativeCaptureFallback(isCapturePermissionIssue(cause)
        ? 'Permissão WebView negada. Tentando captura nativa.'
        : 'WebView falhou. Tentando captura nativa.');
    } finally {
      setSttTestRecording(false);
    }
  }

  async function handleSend(): Promise<void> {
    const payloadAttachments = attachments.map(toChatAttachment);
    const visiblePrompt = prompt.trim() || (payloadAttachments.length > 0 ? 'Anexo enviado.' : '');
    if (!visiblePrompt && payloadAttachments.length === 0) return;
    setPrompt('');
    setAttachments([]);
    await onSendOrder(visiblePrompt, mode, payloadAttachments);
  }

  function resizeTextArea(target: HTMLTextAreaElement): void {
    target.style.height = '0px';
    target.style.height = `${Math.min(target.scrollHeight, 132)}px`;
  }

  function chooseMode(nextMode: InputModeId): void {
    setMode(nextMode);
    setModeOpen(false);
  }

  function openFileManager(): void {
    setPlusOpen(false);
    setFileManagerOpen(true);
  }

  function addAttachment(attachment: SelectedFileAttachment): void {
    setAttachments((current) => [
      attachment,
      ...current.filter((item) => item.path !== attachment.path),
    ].slice(0, 6));
  }

  function appendTranscript(transcript: string): void {
    const cleaned = transcript.trim();
    if (!cleaned) return;
    setPrompt((current) => [current.trim(), cleaned].filter(Boolean).join(' '));
  }

  async function blobToBytes(blob: Blob): Promise<number[]> {
    if (typeof blob.arrayBuffer === 'function') {
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    }
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Não foi possível ler o áudio gravado.'));
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
          return;
        }
        reject(new Error('Formato de áudio gravado inválido.'));
      };
      reader.readAsArrayBuffer(blob);
    });
    return Array.from(new Uint8Array(buffer));
  }

  async function transcribeBlob(blob: Blob): Promise<VoiceTranscriptionResult | undefined> {
    if (blob.size === 0) {
      setVoiceState('error');
      setVoiceMessage('Nenhum áudio foi capturado. Verifique o microfone e tente novamente.');
      return;
    }

    setVoiceState('transcribing');
    setVoiceMessage('Transcrevendo...');
    const snapshot = await refreshSttConfig(sttModelPath);
    try {
      const result = await transcribeAudio(
        await blobToBytes(blob),
        blob.type || undefined,
        sttModelPath.trim() || undefined,
      );
      if (result.status === 'done' && result.text?.trim()) {
        appendTranscript(result.text);
        setVoiceState('done');
        setVoiceMessage('Transcrição adicionada.');
        return result;
      }
      if (result.status === 'missing_backend') {
        const currentSnapshot = snapshot ?? sttSnapshot;
        setVoiceState(shouldTreatMissingBackendAsTranscriptionError(result, currentSnapshot) ? 'error' : 'missing-backend');
        setVoiceMessage(sttFailureMessage(result, currentSnapshot));
        return result;
      }
      setVoiceState('error');
      setVoiceMessage(sttFailureMessage(result, snapshot ?? sttSnapshot));
      return result;
    } catch (cause) {
      setVoiceState('error');
      setVoiceMessage(cleanInlineErrorMessage(cause instanceof Error ? cause.message : undefined, 'Falha ao transcrever áudio local.'));
    }
  }

  async function startBackendRecording(): Promise<void> {
    await refreshSttConfig(sttModelPath);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setWebViewCaptureStatus('denied');
      await runNativeCaptureFallback('Permissão WebView negada. Tentando captura nativa.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
      ].find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordedChunksRef.current = [];
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        stopRecordingTracks();
        setVoiceState('error');
        setVoiceMessage('Falha durante a gravação do microfone.');
      };
      recorder.onstop = () => {
        const chunks = recordedChunksRef.current;
        recordedChunksRef.current = [];
        mediaRecorderRef.current = undefined;
        stopRecordingTracks();
        const audio = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        void transcribeBlob(audio);
      };

      recorder.start();
      setWebViewCaptureStatus('ok');
      setVoiceState('recording');
      setVoiceMessage('Ouvindo... clique novamente para transcrever.');
    } catch (cause) {
      stopRecordingTracks();
      setWebViewCaptureStatus(isCapturePermissionIssue(cause) ? 'denied' : 'error');
      await runNativeCaptureFallback(isCapturePermissionIssue(cause)
        ? 'Permissão WebView negada. Tentando captura nativa.'
        : 'WebView falhou. Tentando captura nativa.');
    }
  }

  function startVoiceInput(): void {
    if (voiceState === 'recording') {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      setVoiceState('transcribing');
      return;
    }
    if (voiceState === 'transcribing') return;
    void startBackendRecording();
  }

  const placeholder = mode === 'code'
    ? 'Descreva o que quer construir, corrigir ou automatizar.'
    : mode === 'terminal'
      ? 'Descreva a ação de terminal para a IA planejar com segurança.'
    : 'Como posso ajudá-lo hoje?';

  return (
    <section className={`command-input-panel prompt-pill-panel mode-${mode}`}>
      {attachments.length > 0 ? (
        <div className="prompt-attachment-list" aria-label="Arquivos selecionados">
          {attachments.map((attachment) => (
            <span key={attachment.path} className="prompt-attachment-chip" title={attachment.path}>
              <UiIcon name={fileIconNameForKind(attachment.kind)} className="prompt-attachment-icon" />
              <span>{attachment.name}</span>
              <small>{formatFileSize(attachment.size)}</small>
              <button
                type="button"
                aria-label={`Remover ${attachment.name}`}
                onClick={() => setAttachments((current) => current.filter((item) => item.path !== attachment.path))}
              >
                <UiIcon name="x" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="prompt-pill">
        <div className="popup-anchor">
          <button
            className="prompt-icon-button prompt-plus-button"
            type="button"
            aria-label="Mais ações"
            onClick={() => setPlusOpen((current) => !current)}
          >
            <UiIcon name="plus" className="prompt-plus-icon" />
          </button>
          <PopupMenu open={plusOpen} onClose={() => setPlusOpen(false)} align="left" className="plus-menu">
            <button type="button" className="menu-item" onClick={openFileManager}>
              <UiIcon name="paperclip" className="menu-icon menu-item-icon" />
              Carregar anexo
            </button>
            {onOpenSkills ? (
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  setPlusOpen(false);
                  onOpenSkills();
                }}
              >
                <UiIcon name="spark" className="menu-icon menu-item-icon" />
                Skills
              </button>
            ) : null}
            <details className="plus-menu-soon">
              <summary>Em breve</summary>
              {PLUS_SOON_ITEMS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="menu-item is-soon"
                  disabled
                  aria-disabled="true"
                  title="Disponível em breve"
                >
                  <UiIcon name={item.icon} className="menu-icon menu-item-icon" />
                  {item.label}
                  <span className="menu-soon-badge">em breve</span>
                </button>
              ))}
            </details>
          </PopupMenu>
        </div>

        <textarea
          className={`prompt-pill-input ${mode === 'terminal' ? 'prompt-pill-terminal' : ''}`}
          placeholder={placeholder}
          value={prompt}
          rows={1}
          onInput={(event) => resizeTextArea(event.currentTarget)}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              if (canSubmit) void handleSend();
            }
          }}
        />

        <div className="prompt-pill-spacer" />

        <div className="popup-anchor">
          <button
            type="button"
            className="prompt-mode-button"
            onClick={() => setModeOpen((current) => !current)}
            aria-label="Selecionar modo de resposta"
          >
            {selectedMode.label} <UiIcon name="chevronDown" />
          </button>
          <PopupMenu open={modeOpen} onClose={() => setModeOpen(false)} placement="auto" align="right">
            {INPUT_MODES.map((item) => (
              <button key={item.id} type="button" className={mode === item.id ? 'active mode-menu-item menu-item' : 'mode-menu-item menu-item'} aria-current={mode === item.id ? 'true' : undefined} onClick={() => chooseMode(item.id)}>
                <UiIcon name={item.icon} className="menu-icon menu-item-icon" />
                <span className="mode-menu-copy">
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </button>
            ))}
          </PopupMenu>
        </div>

        <button
          type="button"
          className={`prompt-mic-button voice-${voiceState}`}
          aria-label={voiceState === 'recording' ? 'Parar transcrição de voz' : 'Entrada por voz'}
          title={voiceMessage}
          onClick={startVoiceInput}
        >
          <UiIcon name="mic" />
        </button>

        <button
          className="prompt-send-button"
          type="button"
          disabled={!canSubmit}
          title={orderDisabledReason}
          onClick={() => void handleSend()}
          aria-label="Enviar"
        >
          <UiIcon name="send" />
        </button>
      </div>
      {(voiceState === 'recording' || voiceState === 'transcribing' || voiceState === 'done') && voiceMessage ? (
        <div className={`voice-feedback voice-${voiceState}`} role="status">
          <span>{voiceMessage}</span>
        </div>
      ) : null}
      {voiceState === 'error' || voiceState === 'missing-backend' || voiceState === 'permission-denied' ? (
        <div className="voice-hint" role="note">
          <span>Voz indisponível agora.</span>
          <button type="button" className="voice-config-button" onClick={openSttSetup}>
            {voiceState === 'permission-denied' ? 'Configurar microfone' : 'Configurar transcrição local'}
          </button>
        </div>
      ) : null}
      {fileManagerOpen ? (
        <FileManagerModal
          open={fileManagerOpen}
          initialPathMode={false}
          onClose={() => setFileManagerOpen(false)}
          onSelect={addAttachment}
        />
      ) : null}
      <PremiumModal
        open={sttSetupOpen}
        title="Transcrição e microfone"
        description="Backend STT e captura de microfone são estados separados. Nada é instalado sem confirmação externa."
        onClose={() => setSttSetupOpen(false)}
        className="stt-config-modal"
      >
        <section className="stt-config-shell">
          <div className="stt-config-summary">
            <StatusDot tone={sttBackendTone(sttSnapshot)} />
            <span>{sttSnapshot?.message ?? (sttSetupLoading ? 'Detectando backends locais...' : 'Abra a detecção para configurar.')}</span>
          </div>
          <div className="stt-status-grid" aria-label="Status de transcrição e captura">
            <div className="stt-status-card">
              <StatusDot tone={sttBackendTone(sttSnapshot)} />
              <span>
                <strong>Backend STT</strong>
                <small>{sttBackendLabel(sttSnapshot)}</small>
              </span>
            </div>
            <div className="stt-status-card">
              <StatusDot tone={sttModelTone(sttSnapshot)} />
              <span>
                <strong>Modelo</strong>
                <small title={sttSnapshot?.modelPath ?? sttModelPath}>{(sttSnapshot?.modelPath ?? sttModelPath) || '~/.codex/models/ggml-base.bin'}</small>
              </span>
            </div>
            <div className="stt-status-card">
              <StatusDot tone={captureStatusTone(webViewCaptureStatus)} />
              <span>
                <strong>Captura WebView</strong>
                <small>{captureStatusLabel(webViewCaptureStatus, true)}</small>
              </span>
            </div>
            <div className="stt-status-card">
              <StatusDot tone={captureStatusTone(nativeCaptureStatus)} />
              <span>
                <strong>Captura nativa</strong>
                <small>{captureStatusLabel(nativeCaptureStatus)}</small>
              </span>
            </div>
          </div>
          {sttSetupError ? <div className="input-error-tip" role="alert">{sttSetupError}</div> : null}
          {sttSnapshot && !sttSnapshot.ready ? (
            <div className="stt-command-box" role="status">
              <strong>Comando Arch sugerido</strong>
              <code>{sttSnapshot.installCommand}</code>
            </div>
          ) : null}
          <div className="stt-command-box stt-mic-help" role="note">
            <strong>Permissão no Linux/Hyprland</strong>
            <span>Se a permissão foi negada, feche e abra o app depois de validar PipeWire e portal desktop.</span>
            <code>systemctl --user status pipewire wireplumber xdg-desktop-portal</code>
          </div>

          <div className="stt-tool-grid" aria-label="Backends de transcrição">
            <div className="stt-tool-row">
              <StatusDot tone={sttSnapshot?.ffmpeg.installed ? 'ready' : 'error'} />
              <span>
                <strong>ffmpeg</strong>
                <small>{sttSnapshot?.ffmpeg.message ?? 'Conversor de áudio'}</small>
              </span>
            </div>
            {(sttSnapshot?.backends ?? []).map((backend) => (
              <div key={backend.id} className="stt-tool-row">
                <StatusDot tone={backend.ready ? 'ready' : backend.installed ? 'warning' : 'offline'} />
                <span>
                  <strong>{backend.label}</strong>
                  <small>{backend.message}</small>
                </span>
              </div>
            ))}
          </div>

          <label className="stt-model-path">
            Caminho do modelo
            <input
              className="input-modern"
              value={sttModelPath}
              placeholder="~/.codex/models/ggml-base.bin"
              onChange={(event) => setSttModelPath(event.target.value)}
            />
          </label>
          {sttSnapshot?.modelCandidates.length ? (
            <div className="stt-candidate-list" aria-label="Modelos locais detectados">
              {sttSnapshot.modelCandidates.slice(0, 6).map((candidate) => (
                <button
                  key={`${candidate.source}:${candidate.path}`}
                  type="button"
                  className={candidate.exists ? '' : 'disabled'}
                  disabled={!candidate.exists}
                  title={candidate.path}
                  onClick={() => setSttModelPath(candidate.path)}
                >
                  <span>{candidate.label}</span>
                  <small>{candidate.source}</small>
                </button>
              ))}
            </div>
          ) : null}

          {sttMicMessage ? <div className="stt-mic-status" role="status">{sttMicMessage}</div> : null}
          {sttRecognizedText ? (
            <div className="stt-mic-status stt-recognized-text" role="status">
              <strong>Texto reconhecido</strong>
              <span>{sttRecognizedText}</span>
            </div>
          ) : null}

          <div className="dialog-actions">
            <button type="button" className="btn-modern" disabled={sttSetupLoading} onClick={() => void saveSttModelPath()}>
              Salvar caminho
            </button>
            <button type="button" className="btn-modern" onClick={() => void testMicrophone()}>
              Testar microfone
            </button>
            <button type="button" className="btn-modern btn-modern-primary" disabled={sttTestRecording} onClick={() => void recordShortSttTest()}>
              {sttTestRecording ? 'Gravando...' : 'Gravar teste curto'}
            </button>
          </div>
        </section>
      </PremiumModal>
    </section>
  );
}
