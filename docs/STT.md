# STT / Microfone

O suporte a voz é local e depende do ambiente real. O app não deve fingir transcrição quando permissão, captura, backend ou modelo estão ausentes.

## Dependências

- WebView com `navigator.mediaDevices`.
- Portal/pipe de áudio funcionando no Wayland quando aplicável.
- Permissão de microfone concedida.
- `ffmpeg` para conversão.
- Um backend local: `whisper.cpp`, `whisper`, `faster-whisper` ou Vosk.
- Modelo local compatível com o backend escolhido.

## Fluxo

1. Composer abre o fluxo do microfone.
2. Frontend solicita permissão e grava áudio.
3. Backend recebe bytes, valida dependências e converte quando necessário.
4. Backend chama o backend local configurado.
5. O texto volta para o composer ou erro acionável é exibido.

## ffmpeg

Validação manual:

```bash
ffmpeg -version
```

Sem `ffmpeg`, o app deve informar que a conversão de áudio não está disponível.

## Backends

Backends aceitos pelo diagnóstico:

- `whisper-cli` ou binário compatível de `whisper.cpp`.
- `whisper`.
- `faster-whisper`.
- Vosk.

O app pode detectar caminhos candidatos, mas não baixa modelo automaticamente.

## Permissão no WebView

Falhas comuns:

- `navigator.mediaDevices` ausente.
- Permissão negada pelo usuário.
- Portal de desktop indisponível.
- PipeWire/WirePlumber sem captura.
- WebView sem policy de microfone.

Nesses casos, a UI deve separar erro de permissão de erro de backend.

## Erros comuns

- Sem permissão: conceder microfone no ambiente gráfico.
- Sem backend: instalar/configurar Whisper ou Vosk.
- Sem modelo: escolher caminho de modelo local.
- Áudio vazio: verificar dispositivo de entrada.
- Conversão falhou: validar `ffmpeg`.
