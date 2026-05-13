# STT and Microphone

Voice input has two separate layers.

## Backend STT

Backend STT needs:

- `ffmpeg`.
- A local backend. `whisper-cli` is the primary supported path; `whisper.cpp`, `whisper`, `faster-whisper` and Vosk are optional alternatives.
- A local model path, commonly `~/.codex/models/ggml-base.bin`.

Check:

```bash
ffmpeg -version
command -v whisper-cli
ls -lh ~/.codex/models/ggml-base.bin
```

If backend STT is ready, the app should not report STT as broken just because WebView microphone capture failed.

## Microphone capture

Ailu tries capture in this order after the user clicks the microphone:

1. WebView capture with `getUserMedia` and `MediaRecorder`.
2. Native short capture fallback when WebView capture is denied, aborted, missing or blocked by portal policy.

Native fallback tries available tools in this order:

1. `pw-record`
2. `parecord`
3. `arecord`
4. `ffmpeg` using the Pulse/PipeWire default input

Temporary WAV files are stored under the system temp directory and deleted after transcription.

## User-facing failure

If capture fails, the UI should show:

```text
Não consegui acessar o microfone. Verifique PipeWire/WirePlumber ou selecione outro dispositivo.
```

Raw backend errors, stack traces and JSON payloads should not be shown in the normal UI.

## Wayland checks

```bash
systemctl --user status pipewire
systemctl --user status wireplumber
systemctl --user status xdg-desktop-portal
```

For a direct native capture test:

```bash
pw-record --channels=1 --rate=16000 /tmp/ailu-mic-test.wav
```
