# STT e Microfone

## Objetivo

O microfone grava áudio curto, transcreve localmente e coloca o texto no composer. O usuário decide quando enviar.

## Fluxo

1. WebView tenta usar Web Speech API quando disponível.
2. Se não houver Web Speech, usa `navigator.mediaDevices.getUserMedia` com `MediaRecorder`.
3. O backend recebe bytes de áudio.
4. `ffmpeg` converte para WAV 16 kHz mono.
5. O backend tenta transcrever com backend local configurado.
6. O texto transcrito volta para o composer.

## Backends Suportados

- `whisper-cli` ou `whisper.cpp`
- `whisper`
- `faster-whisper`
- `vosk-transcriber` ou `vosk`

## Dependências

```bash
command -v ffmpeg
command -v whisper-cli
command -v whisper
command -v faster-whisper
command -v vosk-transcriber
```

O app também procura modelos em:

```text
~/.codex/models
~/.local/share/codex/models
~/.local/share/whisper.cpp
~/.cache/whisper
```

## Estado Atual do Host na Passada 13

- `ffmpeg`: encontrado em `/usr/bin/ffmpeg`.
- `whisper-cli`: não encontrado.
- `whisper`: não encontrado.
- `faster-whisper`: não encontrado.
- `vosk-transcriber`: não encontrado.
- modelos STT locais em `~/.codex/models` ou `~/.local/share/codex/models`: não encontrados na varredura segura.

Resultado: gravação pode depender do WebView/portal, mas transcrição local completa ainda exige instalar um backend STT e apontar um modelo local.

## Instalação Manual Sugerida no Arch

```bash
sudo pacman -S --needed ffmpeg whisper.cpp
```

Depois baixe/posicione um modelo Whisper em `~/.codex/models`, por exemplo `ggml-base.bin`, e configure o caminho no modal de STT do composer.

O app não executa esse comando automaticamente.
