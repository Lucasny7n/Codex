import { useEffect, useRef, useState } from 'react';
import { getSttConfigState, transcribeAudio } from '../../lib/api';
import { readStoredSttModelPath, writeStoredSttModelPath } from '../../lib/stt/modelPath';
import type { PrivilegedActionSpec } from '../../types/domain';
import type { ChatAttachment, LocalSttConfigSnapshot, SelectedFileAttachment } from '../../types/domain';
import { UiIcon } from '../common/AppIcons';
import { FileManagerModal } from '../file/FileManagerModal';
import { fileIconNameForKind, formatFileSize } from '../file/fileDisplay';
import { PopupMenu, PremiumModal, StatusDot } from '../common/PremiumUI';

interface CommandInputPanelProps {
  busy: boolean;
  privilegedActions: PrivilegedActionSpec[];
  onSendOrder: (order: string, mode: InputModeId, attachments: ChatAttachment[]) => Promise<void>;
  onExecuteCommand: (command: string) => Promise<void>;
  onRequestPrivilegedAction: (actionId: string, args: Record<string, unknown>, dryRun: boolean) => Promise<void>;
  actionJsonExamples: Record<string, string>;
  orderDisabledReason?: string;
  executionMode?: 'cloud' | 'local';
  activeModelLabel?: string;
  providerLabel?: string;
  runtimeState?: string;
  onOpenModelSelector?: () => void;
  onOpenTerminal?: () => void;
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

type SpeechRecognitionEventLike = Event & {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionErrorEventLike = Event & {
  error?: string;
};

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type VoiceState =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'done'
  | 'error'
  | 'missing-backend'
  | 'permission-denied';

function localTranscriptionMessage(message?: string, command?: string): string {
  const normalized = message?.toLowerCase() ?? '';
  const reason = normalized.includes('whisper') && (normalized.includes('modelo') || normalized.includes('model'))
    ? 'Modelo Whisper não encontrado.'
    : 'Backend local não configurado.';
  return command ? `${reason} Configurar transcrição local: ${command}` : `${reason} Configure transcrição local.`;
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

function toChatAttachment(attachment: SelectedFileAttachment): ChatAttachment {
  const preview = attachment.preview && attachment.preview.length <= 2400
    ? attachment.preview
    : attachment.preview
      ? `${attachment.preview.slice(0, 2400)}\n[preview truncado pelo composer]`
      : undefined;
  return {
    path: attachment.path,
    name: attachment.name,
    mimeType: mimeTypeForAttachment(attachment),
    size: attachment.size,
    kind: attachment.kind,
    previewAvailable: Boolean(attachment.preview),
    previewTextLimited: preview,
  };
}

export function CommandInputPanel({
  busy,
  onSendOrder,
  orderDisabledReason,
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
  const [sttTestRecording, setSttTestRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike>();
  const mediaRecorderRef = useRef<MediaRecorder>();
  const recordingStreamRef = useRef<MediaStream>();
  const recordedChunksRef = useRef<Blob[]>([]);

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
    recognitionRef.current?.abort();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    stopRecordingTracks();
  }, []);

  async function refreshSttConfig(path = sttModelPath): Promise<void> {
    setSttSetupLoading(true);
    setSttSetupError(undefined);
    try {
      const snapshot = await getSttConfigState(path.trim() || undefined);
      setSttSnapshot(snapshot);
      if (!path.trim() && snapshot.modelPath) {
        setSttModelPath(snapshot.modelPath);
      }
    } catch (cause) {
      setSttSetupError(cleanInlineErrorMessage(cause instanceof Error ? cause.message : undefined, 'Falha ao detectar transcrição local.'));
    } finally {
      setSttSetupLoading(false);
    }
  }

  function openSttSetup(): void {
    setSttSetupOpen(true);
    setSttSetupError(undefined);
    setSttMicMessage(undefined);
    void refreshSttConfig(sttModelPath);
  }

  async function saveSttModelPath(): Promise<void> {
    const path = sttModelPath.trim();
    writeStoredSttModelPath(path);
    await refreshSttConfig(path);
  }

  async function testMicrophone(): Promise<void> {
    setSttMicMessage(undefined);
    if (!navigator.mediaDevices?.getUserMedia) {
      setSttMicMessage('Microfone indisponível no WebView atual.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setSttMicMessage('getUserMedia liberou acesso ao microfone. Grave um teste curto para validar a transcrição local.');
    } catch (cause) {
      const name = cause instanceof DOMException ? cause.name : '';
      setSttMicMessage(name === 'NotAllowedError' ? 'Permissão negada pelo WebView/portal de microfone.' : 'Não foi possível abrir o microfone.');
    }
  }

  async function recordShortSttTest(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setSttMicMessage('Gravação local indisponível neste WebView.');
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
      setSttMicMessage('Transcrevendo teste...');
      await transcribeBlob(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
      setSttMicMessage('Teste concluído. Se houve fala, ela foi adicionada ao composer.');
    } catch (cause) {
      setSttMicMessage(cleanInlineErrorMessage(cause instanceof Error ? cause.message : undefined, 'Teste de transcrição não concluído.'));
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

  async function transcribeBlob(blob: Blob): Promise<void> {
    if (blob.size === 0) {
      setVoiceState('error');
      setVoiceMessage('Nenhum áudio foi capturado. Verifique o microfone e tente novamente.');
      return;
    }

    setVoiceState('transcribing');
    setVoiceMessage('Transcrevendo...');
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
        return;
      }
      if (result.status === 'missing_backend') {
        setVoiceState('missing-backend');
        setVoiceMessage(localTranscriptionMessage(result.message, result.command));
        return;
      }
      setVoiceState('error');
      setVoiceMessage(result.message || 'Não foi possível transcrever o áudio local.');
    } catch (cause) {
      setVoiceState('error');
      setVoiceMessage(cleanInlineErrorMessage(cause instanceof Error ? cause.message : undefined, 'Falha ao transcrever áudio local.'));
    }
  }

  async function startBackendRecording(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceState('missing-backend');
      setVoiceMessage('Gravação local indisponível neste WebView. Configure WebKit/portal de microfone ou use um backend STT local com ffmpeg e whisper.cpp.');
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
      setVoiceState('recording');
      setVoiceMessage('Ouvindo... clique novamente para transcrever.');
    } catch (cause) {
      stopRecordingTracks();
      const name = cause instanceof DOMException ? cause.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setVoiceState('permission-denied');
        setVoiceMessage('Permissão negada pelo WebView/portal. Revise a política de microfone do Tauri e confirme PipeWire/WirePlumber antes de tentar novamente.');
        return;
      }
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setVoiceState('error');
        setVoiceMessage('Nenhum microfone foi encontrado.');
        return;
      }
      setVoiceState('error');
      setVoiceMessage('Não foi possível iniciar a gravação local.');
    }
  }

  function startVoiceInput(): void {
    if (voiceState === 'recording') {
      recognitionRef.current?.stop();
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      setVoiceState('transcribing');
      return;
    }
    if (voiceState === 'transcribing') return;

    const SpeechRecognition = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      void startBackendRecording();
      return;
    }

    const recognition = new SpeechRecognition();
    let transcriptReceived = false;
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => {
      setVoiceState('recording');
      setVoiceMessage('Ouvindo...');
    };
    recognition.onresult = (event) => {
      transcriptReceived = true;
      setVoiceState('transcribing');
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim();
      appendTranscript(transcript);
      setVoiceState('done');
      setVoiceMessage(transcript ? 'Transcrição adicionada.' : 'Nenhuma fala reconhecida.');
    };
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setVoiceState('permission-denied');
        setVoiceMessage('Permissão negada. Revise a permissão do WebView e confirme PipeWire/WirePlumber.');
        return;
      }
      setVoiceState('error');
      setVoiceMessage('Não foi possível transcrever a voz.');
    };
    recognition.onend = () => {
      setVoiceState((current) => {
        if (current !== 'recording' && current !== 'transcribing') return current;
        return transcriptReceived ? 'done' : 'idle';
      });
    };
    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setVoiceState('error');
      setVoiceMessage('Não foi possível iniciar o microfone.');
    }
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
          <PopupMenu open={plusOpen} onClose={() => setPlusOpen(false)} align="left">
            <button type="button" className="menu-item" onClick={openFileManager}>
              <UiIcon name="paperclip" className="menu-icon menu-item-icon" />
              Selecionar arquivo
            </button>
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
      {voiceMessage ? (
        <div
          className={`voice-feedback voice-${voiceState}`}
          role={voiceState === 'error' || voiceState === 'missing-backend' || voiceState === 'permission-denied' ? 'alert' : 'status'}
        >
          <span>{voiceMessage}</span>
          {voiceState === 'missing-backend' || voiceState === 'error' || voiceState === 'permission-denied' ? (
            <button type="button" className="voice-config-button" onClick={openSttSetup}>
              {voiceState === 'permission-denied' ? 'Configurar microfone' : 'Configurar transcrição local'}
            </button>
          ) : null}
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
        title="Configurar transcrição local"
        description="STT local com ffmpeg, whisper.cpp, faster-whisper ou Vosk. Nada é instalado sem confirmação externa."
        onClose={() => setSttSetupOpen(false)}
        className="stt-config-modal"
      >
        <section className="stt-config-shell">
          <div className="stt-config-summary">
            <StatusDot tone={sttSnapshot?.ready ? 'ready' : 'warning'} />
            <span>{sttSnapshot?.message ?? (sttSetupLoading ? 'Detectando backends locais...' : 'Abra a detecção para configurar.')}</span>
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
