# Troubleshooting

Start with:

```bash
npm run doctor
npm run healthcheck
```

## Ollama offline

```bash
command -v ollama
ollama --version
ollama list
curl -s http://127.0.0.1:11434/api/tags
```

If the CLI works but the API fails, check the Ollama service and port `11434`.

## Local model does not appear

- Confirm the exact name in `ollama list`.
- Check `/api/tags`.
- Include the tag when needed, for example `qwen2.5-coder:7b`.
- Refresh the local runtime snapshot in the app.

## Cloud provider is not selectable

- Add or replace the provider API key/profile.
- Run the provider connection test.
- Check whether the failure is key, quota, provider outage or model access.
- Do not force selection when status is not ready.

## STT backend is ready but microphone fails

This means transcription dependencies are available but capture is blocked.

Check:

```bash
systemctl --user status pipewire
systemctl --user status wireplumber
systemctl --user status xdg-desktop-portal
```

Then use the STT modal button `Record short test`. Ailu will try WebView capture first and native short capture fallback if the WebView path fails.

## Icon or desktop entry missing

```bash
npm run icons:validate
bash scripts/install-desktop-entry.sh
```

The desktop entry should use:

```text
Name=Ailu AI Studio
Icon=ailu-ai-studio
StartupWMClass=ailu-ai-studio
```

## Vite port already in use

```bash
lsof -n -P -iTCP:5173 -sTCP:LISTEN
```

Stop the process or run the frontend on another port before starting Tauri.

## Raw technical error in UI

This is a bug. Open an issue and include:

- Area of the app.
- User-facing message shown.
- Redacted technical detail.
- Commands/tests run.
