# Installation

## Supported target

Ailu AI Studio currently targets Linux desktop development, with special attention to Arch Linux, Wayland, PipeWire and Tauri.

## Required tools

- Node.js and npm.
- Rust stable and Cargo.
- Tauri Linux dependencies for WebKitGTK.
- Git.

Check what is available:

```bash
npm run doctor
```

## Arch Linux packages

Typical packages:

```bash
sudo pacman -S --needed nodejs npm rustup webkit2gtk-4.1 gtk3 libayatana-appindicator librsvg base-devel pkgconf openssl
```

Do not paste this blindly on a production machine. The setup helper prints commands and asks before privileged package steps:

```bash
bash scripts/setup-linux.sh
```

## Optional local AI

Install Ollama using the official instructions for your distribution, then verify:

```bash
ollama --version
ollama list
curl -s http://127.0.0.1:11434/api/tags
```

Ailu does not silently download large models. Downloads happen only after an explicit model action.

## Optional STT

Recommended local STT tools:

```bash
sudo pacman -S --needed ffmpeg whisper.cpp
```

On Arch, `whisper.cpp` usually provides `whisper-cli`. Ailu treats
`whisper-cli` as the primary backend; the separate `whisper.cpp` binary is
optional when `whisper-cli` and a local model are available.

Place a Whisper model in `~/.codex/models`, for example:

```text
~/.codex/models/ggml-base.bin
```

The app detects the backend and the model path separately from microphone capture.

## Desktop entry

Install the user desktop entry and icons:

```bash
bash scripts/install-desktop-entry.sh
```

This writes to `~/.local/share/applications` and `~/.local/share/icons/hicolor`.
