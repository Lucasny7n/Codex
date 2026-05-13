import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../src/lib/api';
import { CommandInputPanel } from '../src/components/chat/CommandInputPanel';

vi.mock('../src/lib/api', () => ({
  getFileAttachment: vi.fn(),
  listFileDirectory: vi.fn(),
  getSttConfigState: vi.fn(),
  recordAndTranscribeShortTest: vi.fn(),
  transcribeAudio: vi.fn(),
}));

function mockFileListing(): void {
  vi.mocked(api.listFileDirectory).mockResolvedValue({
    path: '/tmp',
    parentPath: '/',
    shortcuts: [
      { id: 'home', label: 'Home', path: '/home/lucas', exists: true },
      { id: 'downloads', label: 'Downloads', path: '/home/lucas/Downloads', exists: true },
    ],
    entries: [
      {
        name: 'relatorio.md',
        path: '/tmp/relatorio.md',
        kind: 'text',
        extension: 'md',
        isDirectory: false,
        size: 1200,
        modifiedAt: '2026-05-08T12:00:00Z',
      },
    ],
    truncated: false,
  });
}

describe('CommandInputPanel', () => {
  class MockMediaRecorder {
    static isTypeSupported = vi.fn(() => true);
    mimeType = 'audio/webm';
    state: RecordingState = 'inactive';
    ondataavailable: ((event: BlobEvent) => void) | null = null;
    onerror: (() => void) | null = null;
    onstop: (() => void) | null = null;
    start(): void {
      this.state = 'recording';
    }
    stop(): void {
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob(['audio']) } as BlobEvent);
      this.onstop?.();
    }
  }

  beforeEach(() => {
    vi.clearAllMocks();
    Reflect.deleteProperty(window, 'SpeechRecognition');
    Reflect.deleteProperty(window, 'webkitSpeechRecognition');
    Reflect.deleteProperty(window.navigator, 'mediaDevices');
    mockFileListing();
    vi.mocked(api.getFileAttachment).mockResolvedValue({
      name: 'relatorio.md',
      path: '/tmp/relatorio.md',
      kind: 'text',
      extension: 'md',
      isDirectory: false,
      size: 1200,
      modifiedAt: '2026-05-08T12:00:00Z',
      preview: 'preview seguro',
      previewKind: 'text',
      previewTruncated: false,
    });
    vi.mocked(api.getSttConfigState).mockResolvedValue({
      ffmpeg: {
        id: 'ffmpeg',
        label: 'ffmpeg',
        installed: false,
        ready: false,
        message: 'ffmpeg ausente.',
      },
      backends: [],
      modelExists: false,
      modelCandidates: [],
      ready: false,
      installCommand: 'sudo pacman -S ffmpeg whisper.cpp',
      message: 'Nenhum backend STT local encontrado.',
      capture: {
        webviewStatus: 'ok',
        webviewMessage: 'PipeWire, WirePlumber e portal ativos.',
        nativeStatus: 'ok',
        nativeMessage: 'Fallback nativo disponível via pw-record.',
        nativeTools: ['pw-record'],
      },
      checkedAt: new Date().toISOString(),
    });
    vi.mocked(api.recordAndTranscribeShortTest).mockResolvedValue({
      status: 'error',
      message: 'Não consegui gravar áudio pelo fallback nativo. Verifique o dispositivo de entrada.',
      backend: 'native-capture',
      captureStatus: 'error',
      captureBackend: 'pw-record',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('bloqueia envio de ordem quando provider está indisponível', () => {
    render(
      <CommandInputPanel
        busy={false}
        privilegedActions={[]}
        actionJsonExamples={{}}
        onSendOrder={vi.fn()}
        onExecuteCommand={vi.fn()}
        onRequestPrivilegedAction={vi.fn()}
        orderDisabledReason="Provider indisponível"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Como posso ajudá-lo hoje?'), {
      target: { value: 'rode uma tarefa' }
    });

    expect(screen.queryByText('Provider indisponível')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Enviar')).toBeDisabled();
    expect(screen.getByLabelText('Enviar')).toHaveAttribute('title', 'Provider indisponível');
  });

  it('mantem terminal como conversa sem abrir logs automaticamente', async () => {
    const onOpenTerminal = vi.fn();
    const onSendOrder = vi.fn().mockResolvedValue(undefined);

    render(
      <CommandInputPanel
        busy={false}
        privilegedActions={[]}
        actionJsonExamples={{}}
        onSendOrder={onSendOrder}
        onExecuteCommand={vi.fn()}
        onRequestPrivilegedAction={vi.fn()}
        onOpenTerminal={onOpenTerminal}
      />,
    );

    fireEvent.click(screen.getByLabelText('Selecionar modo de resposta'));
    fireEvent.click(screen.getByText('Terminal'));
    expect(onOpenTerminal).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText('Descreva a ação de terminal para a IA planejar com segurança.'), {
      target: { value: 'liste arquivos com risco baixo' },
    });
    fireEvent.click(screen.getByLabelText('Enviar'));

    await waitFor(() => {
      expect(onSendOrder).toHaveBeenCalledWith('liste arquivos com risco baixo', 'terminal', []);
    });
  });

  it('menu do + mostra somente Selecionar arquivo', () => {
    render(
      <CommandInputPanel
        busy={false}
        privilegedActions={[]}
        actionJsonExamples={{}}
        onSendOrder={vi.fn()}
        onExecuteCommand={vi.fn()}
        onRequestPrivilegedAction={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Mais ações'));

    expect(screen.getByText('Selecionar arquivo')).toBeInTheDocument();
    expect(screen.queryByText('Selecionar pasta')).not.toBeInTheDocument();
    expect(screen.queryByText('Usar caminho do PC')).not.toBeInTheDocument();
    expect(screen.queryByText('Usar terminal')).not.toBeInTheDocument();
    expect(screen.queryByText('Configurar modelos')).not.toBeInTheDocument();
  });

  it('abre seletor de modos e envia o modo junto do pedido', async () => {
    const onSendOrder = vi.fn().mockResolvedValue(undefined);

    render(
      <CommandInputPanel
        busy={false}
        privilegedActions={[]}
        actionJsonExamples={{}}
        onSendOrder={onSendOrder}
        onExecuteCommand={vi.fn()}
        onRequestPrivilegedAction={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Selecionar modo de resposta'));
    expect(screen.getAllByText('Automático').length).toBeGreaterThan(1);
    expect(screen.getByText('Pensamento')).toBeInTheDocument();
    expect(screen.getByText('Rápido')).toBeInTheDocument();
    expect(screen.getByText('Código')).toBeInTheDocument();
    expect(screen.getByText('Terminal')).toBeInTheDocument();
    expect(screen.queryByText('Agente')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Código'));
    fireEvent.change(screen.getByPlaceholderText('Descreva o que quer construir, corrigir ou automatizar.'), {
      target: { value: 'implemente teste' },
    });
    fireEvent.click(screen.getByLabelText('Enviar'));

    await waitFor(() => {
      expect(onSendOrder).toHaveBeenCalledWith('implemente teste', 'code', []);
    });
  });

  it('não renderiza seletor nativo de preset e não injeta preset oculto no envio', async () => {
    const onSendOrder = vi.fn().mockResolvedValue(undefined);

    render(
      <CommandInputPanel
        busy={false}
        privilegedActions={[]}
        actionJsonExamples={{}}
        onSendOrder={onSendOrder}
        onExecuteCommand={vi.fn()}
        onRequestPrivilegedAction={vi.fn()}
      />,
    );

    expect(document.querySelector('.prompt-preset-select')).toBeNull();
    expect(screen.queryByLabelText('Selecionar preset')).not.toBeInTheDocument();
    expect(screen.queryByText('Geral')).not.toBeInTheDocument();
    expect(screen.queryByText('Programador')).not.toBeInTheDocument();
    expect(screen.queryByText('Terminal seguro')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Como posso ajudá-lo hoje?'), {
      target: { value: 'corrija este bug' },
    });
    fireEvent.click(screen.getByLabelText('Enviar'));

    await waitFor(() => {
      expect(onSendOrder).toHaveBeenCalledWith(
        'corrija este bug',
        'auto',
        [],
      );
    });
  });

  it('limpa o composer imediatamente ao enviar', async () => {
    let resolveSend: (() => void) | undefined;
    const onSendOrder = vi.fn(() => new Promise<void>((resolve) => {
      resolveSend = resolve;
    }));

    render(
      <CommandInputPanel
        busy={false}
        privilegedActions={[]}
        actionJsonExamples={{}}
        onSendOrder={onSendOrder}
        onExecuteCommand={vi.fn()}
        onRequestPrivilegedAction={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText('Como posso ajudá-lo hoje?');
    fireEvent.change(input, { target: { value: 'mensagem imediata' } });
    fireEvent.click(screen.getByLabelText('Enviar'));

    expect(input).toHaveValue('');
    expect(onSendOrder).toHaveBeenCalledWith('mensagem imediata', 'auto', []);
    resolveSend?.();
  });

  it('usa captura WebView antes do fallback nativo', async () => {
    const stop = vi.fn();
    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop }],
        }),
      },
    });
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    vi.mocked(api.transcribeAudio).mockResolvedValue({
      status: 'done',
      text: 'texto falado',
      message: 'ok',
      backend: 'whisper-cli',
    });

    render(
      <CommandInputPanel
        busy={false}
        privilegedActions={[]}
        actionJsonExamples={{}}
        onSendOrder={vi.fn()}
        onExecuteCommand={vi.fn()}
        onRequestPrivilegedAction={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Entrada por voz'));
    expect(await screen.findByRole('status')).toHaveTextContent('Ouvindo...');
    fireEvent.click(screen.getByLabelText('Parar transcrição de voz'));

    await waitFor(() => {
      expect(api.transcribeAudio).toHaveBeenCalled();
      expect(api.recordAndTranscribeShortTest).not.toHaveBeenCalled();
      expect(screen.getByDisplayValue('texto falado')).toBeInTheDocument();
    });
  });

  it('tenta backend local quando Web Speech não existe e preenche o input', async () => {
    const stop = vi.fn();
    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop }],
        }),
      },
    });
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    vi.mocked(api.transcribeAudio).mockResolvedValue({
      status: 'done',
      text: 'texto local transcrito',
      message: 'ok',
      backend: 'whisper-cli',
    });

    render(
      <CommandInputPanel
        busy={false}
        privilegedActions={[]}
        actionJsonExamples={{}}
        onSendOrder={vi.fn()}
        onExecuteCommand={vi.fn()}
        onRequestPrivilegedAction={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Entrada por voz'));
    expect(await screen.findByRole('status')).toHaveTextContent('Ouvindo...');
    fireEvent.click(screen.getByLabelText('Parar transcrição de voz'));

    await waitFor(() => {
      expect(api.transcribeAudio).toHaveBeenCalled();
      expect(screen.getByDisplayValue('texto local transcrito')).toBeInTheDocument();
    });
    expect(stop).toHaveBeenCalled();
  });

  it('mostra erro útil quando backend local de voz está ausente', async () => {
    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
    });
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    vi.mocked(api.transcribeAudio).mockResolvedValue({
      status: 'missing_backend',
      message: 'Nenhum backend local de transcrição foi encontrado.',
      command: 'sudo pacman -S ffmpeg whisper.cpp',
    });

    render(
      <CommandInputPanel
        busy={false}
        privilegedActions={[]}
        actionJsonExamples={{}}
        onSendOrder={vi.fn()}
        onExecuteCommand={vi.fn()}
        onRequestPrivilegedAction={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Entrada por voz'));
    fireEvent.click(await screen.findByLabelText('Parar transcrição de voz'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Backend local não configurado');
    expect(await screen.findByRole('alert')).toHaveTextContent('sudo pacman -S ffmpeg whisper.cpp');

    fireEvent.click(screen.getByText('Configurar transcrição local'));
    expect(await screen.findByRole('dialog', { name: 'Transcrição e microfone' })).toBeInTheDocument();
    expect(api.getSttConfigState).toHaveBeenCalled();
    expect(screen.getByText('Backend STT')).toBeInTheDocument();
    expect(screen.getByText('Captura WebView')).toBeInTheDocument();
    expect(screen.getByText('Captura nativa')).toBeInTheDocument();
    expect(screen.getByText('Comando Arch sugerido')).toBeInTheDocument();
    expect(screen.getByText('sudo pacman -S ffmpeg whisper.cpp')).toBeInTheDocument();
  });

  it('limpa erro bruto de STT antes de mostrar na UI', async () => {
    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
    });
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    vi.mocked(api.transcribeAudio).mockRejectedValue(new Error('{"error":"stack trace interno","stack":"secret"}\nStack trace: linha 1'));

    render(
      <CommandInputPanel
        busy={false}
        privilegedActions={[]}
        actionJsonExamples={{}}
        onSendOrder={vi.fn()}
        onExecuteCommand={vi.fn()}
        onRequestPrivilegedAction={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Entrada por voz'));
    fireEvent.click(await screen.findByLabelText('Parar transcrição de voz'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao transcrever áudio local.');
    expect(screen.queryByText(/stack trace interno/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Stack trace/i)).not.toBeInTheDocument();
  });

  it('tenta fallback nativo quando a permissão do WebView é negada', async () => {
    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')),
      },
    });
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);

    render(
      <CommandInputPanel
        busy={false}
        privilegedActions={[]}
        actionJsonExamples={{}}
        onSendOrder={vi.fn()}
        onExecuteCommand={vi.fn()}
        onRequestPrivilegedAction={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Entrada por voz'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não consegui gravar áudio pelo fallback nativo');
    expect(api.recordAndTranscribeShortTest).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Configurar transcrição local'));
    expect(await screen.findByRole('dialog', { name: 'Transcrição e microfone' })).toBeInTheDocument();
    expect(screen.getByText('Permissão no Linux/Hyprland')).toBeInTheDocument();
  });

  it('não mostra erro falso de modelo Whisper quando o backend está pronto', async () => {
    vi.mocked(api.getSttConfigState).mockResolvedValueOnce({
      ffmpeg: {
        id: 'ffmpeg',
        label: 'ffmpeg',
        installed: true,
        ready: true,
        message: 'ffmpeg disponível.',
      },
      backends: [
        {
          id: 'whisper-cli',
          label: 'whisper-cli',
          installed: true,
          ready: true,
          message: 'whisper-cli pronto com modelo local.',
        },
      ],
      modelPath: '/home/lucas/.codex/models/ggml-base.bin',
      modelExists: true,
      modelCandidates: [
        {
          label: 'ggml-base.bin',
          path: '/home/lucas/.codex/models/ggml-base.bin',
          source: 'default',
          exists: true,
        },
      ],
      ready: true,
      installCommand: 'sudo pacman -S ffmpeg whisper.cpp',
      message: 'Transcrição local pronta. Modelo: /home/lucas/.codex/models/ggml-base.bin',
      capture: {
        webviewStatus: 'ok',
        webviewMessage: 'PipeWire, WirePlumber e portal ativos.',
        nativeStatus: 'ok',
        nativeMessage: 'Fallback nativo disponível via pw-record.',
        nativeTools: ['pw-record'],
      },
      checkedAt: new Date().toISOString(),
    });

    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')),
      },
    });
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);

    render(
      <CommandInputPanel
        busy={false}
        privilegedActions={[]}
        actionJsonExamples={{}}
        onSendOrder={vi.fn()}
        onExecuteCommand={vi.fn()}
        onRequestPrivilegedAction={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Entrada por voz'));
    fireEvent.click(await screen.findByText('Configurar transcrição local'));

    expect(await screen.findByRole('dialog', { name: 'Transcrição e microfone' })).toBeInTheDocument();
    expect(screen.getByText('Transcrição local pronta. Modelo: /home/lucas/.codex/models/ggml-base.bin')).toBeInTheDocument();
    expect(screen.getByText('/home/lucas/.codex/models/ggml-base.bin')).toBeInTheDocument();
    expect(screen.queryByText('Modelo Whisper não encontrado.')).not.toBeInTheDocument();
    expect(screen.queryByText('Comando Arch sugerido')).not.toBeInTheDocument();
  });

  it('fallback nativo mockado adiciona texto transcrito ao composer', async () => {
    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new DOMException('portal denied', 'NotAllowedError')),
      },
    });
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    vi.mocked(api.recordAndTranscribeShortTest).mockResolvedValueOnce({
      status: 'done',
      text: 'texto nativo reconhecido',
      message: 'ok',
      backend: 'whisper-cli',
      captureStatus: 'ok',
      captureBackend: 'pw-record',
    });

    render(
      <CommandInputPanel
        busy={false}
        privilegedActions={[]}
        actionJsonExamples={{}}
        onSendOrder={vi.fn()}
        onExecuteCommand={vi.fn()}
        onRequestPrivilegedAction={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Entrada por voz'));

    await waitFor(() => {
      expect(api.recordAndTranscribeShortTest).toHaveBeenCalled();
      expect(screen.getByDisplayValue('texto nativo reconhecido')).toBeInTheDocument();
    });
  });

  it('abre seletor interno, adiciona chip de arquivo e remove o chip', async () => {
    render(
      <CommandInputPanel
        busy={false}
        privilegedActions={[]}
        actionJsonExamples={{}}
        onSendOrder={vi.fn()}
        onExecuteCommand={vi.fn()}
        onRequestPrivilegedAction={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Mais ações'));
    fireEvent.click(screen.getByText('Selecionar arquivo'));

    expect(await screen.findByRole('dialog', { name: 'Selecionar arquivo' })).toBeInTheDocument();
    expect(await screen.findByText('relatorio.md')).toBeInTheDocument();

    fireEvent.click(screen.getByText('relatorio.md'));
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Selecionar arquivo' })).not.toBeInTheDocument();
    });
    expect(screen.getByText('relatorio.md')).toBeInTheDocument();
    expect(screen.getByText('1.2 KB')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Remover relatorio.md'));
    expect(screen.queryByText('relatorio.md')).not.toBeInTheDocument();
  });

  it('envia arquivo selecionado como anexo bruto/metadado sem despejar preview no texto', async () => {
    const onSendOrder = vi.fn().mockResolvedValue(undefined);

    render(
      <CommandInputPanel
        busy={false}
        privilegedActions={[]}
        actionJsonExamples={{}}
        onSendOrder={onSendOrder}
        onExecuteCommand={vi.fn()}
        onRequestPrivilegedAction={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Enviar')).toBeDisabled();

    fireEvent.click(screen.getByLabelText('Mais ações'));
    fireEvent.click(screen.getByText('Selecionar arquivo'));
    fireEvent.click(await screen.findByText('relatorio.md'));
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Enviar')).not.toBeDisabled();
    });

    fireEvent.click(screen.getByLabelText('Enviar'));

    await waitFor(() => {
      expect(onSendOrder).toHaveBeenCalledWith('Anexo enviado.', 'auto', [
        expect.objectContaining({
          path: '/tmp/relatorio.md',
          name: 'relatorio.md',
          mimeType: 'text/plain',
          size: 1200,
          kind: 'text',
          previewAvailable: true,
          previewTextLimited: 'preview seguro',
        }),
      ]);
    });
  });

  it('mantém chip de arquivo com nome longo sem despejar TXT no composer', async () => {
    const longName = 'relatorio-final-com-nome-muito-longo-para-validar-truncamento-do-chip-de-anexo.md';
    vi.mocked(api.listFileDirectory).mockResolvedValueOnce({
      path: '/tmp',
      parentPath: '/',
      shortcuts: [],
      entries: [
        {
          name: longName,
          path: `/tmp/${longName}`,
          kind: 'text',
          extension: 'md',
          isDirectory: false,
          size: 34567,
          modifiedAt: '2026-05-08T12:00:00Z',
        },
      ],
      truncated: false,
    });
    vi.mocked(api.getFileAttachment).mockResolvedValueOnce({
      name: longName,
      path: `/tmp/${longName}`,
      kind: 'text',
      extension: 'md',
      isDirectory: false,
      size: 34567,
      modifiedAt: '2026-05-08T12:00:00Z',
      preview: 'conteúdo TXT que não deve aparecer no campo visível',
      previewKind: 'text',
      previewTruncated: false,
    });

    const onSendOrder = vi.fn().mockResolvedValue(undefined);
    render(
      <CommandInputPanel
        busy={false}
        privilegedActions={[]}
        actionJsonExamples={{}}
        onSendOrder={onSendOrder}
        onExecuteCommand={vi.fn()}
        onRequestPrivilegedAction={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Mais ações'));
    fireEvent.click(screen.getByText('Selecionar arquivo'));
    fireEvent.click(await screen.findByText(longName));
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar' }));

    await waitFor(() => {
      expect(screen.getByTitle(`/tmp/${longName}`)).toBeInTheDocument();
    });
    expect(screen.queryByDisplayValue(/conteúdo TXT/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Enviar'));

    await waitFor(() => {
      expect(onSendOrder).toHaveBeenCalledWith('Anexo enviado.', 'auto', [
        expect.objectContaining({
          name: longName,
          previewTextLimited: 'conteúdo TXT que não deve aparecer no campo visível',
        }),
      ]);
    });
  });

  it('mostra erro bonito para caminho local inválido e Esc fecha o modal', async () => {
    vi.mocked(api.getFileAttachment).mockRejectedValueOnce(new Error('Caminho não encontrado ou inacessível.'));

    render(
      <CommandInputPanel
        busy={false}
        privilegedActions={[]}
        actionJsonExamples={{}}
        onSendOrder={vi.fn()}
        onExecuteCommand={vi.fn()}
        onRequestPrivilegedAction={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Mais ações'));
    fireEvent.click(screen.getByText('Selecionar arquivo'));
    fireEvent.click(await screen.findByText('Usar caminho do PC'));

    const pathInput = await screen.findByLabelText('Caminho local');
    fireEvent.change(pathInput, { target: { value: '/tmp/nao-existe.pdf' } });
    fireEvent.click(screen.getByText('Validar'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Caminho não encontrado ou inacessível.');

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Selecionar arquivo' })).not.toBeInTheDocument();
    });
  });
});
