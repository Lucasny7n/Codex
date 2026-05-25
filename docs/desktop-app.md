# Desktop App

Ailu AI Studio is already configured as a Tauri 2 desktop application.

## Current Desktop Configuration

- Product name: `Ailu AI Studio`.
- Identifier: `com.lucasny7n.ailu.ai.studio`.
- Main binary: `ailu-ai-studio`.
- Default window: `1440x900`.
- Minimum window: `900x600`.
- Resizable: enabled.
- Fullscreen: optional, not forced.
- Decorations: disabled to preserve the current custom shell.
- Linux bundle targets: `deb`, `rpm`.
- Desktop entry: `assets/ailu-ai-studio.desktop`.

## Development

```bash
npm run tauri:dev
```

If port `5173` is already in use, inspect the process before assuming the app is broken.

## V2 Runtime Smoke

On 2026-05-17, the desktop app was started with an isolated Cargo target:

```bash
env CARGO_TARGET_DIR=/tmp/ailu-ai-studio-cargo-target npm run tauri:dev
```

Result:

- Vite served `http://localhost:5173/`.
- Rust compiled successfully.
- The Tauri binary ran from `/tmp/ailu-ai-studio-cargo-target/debug/ailu-ai-studio`.
- The session was stopped after visual validation.

One Playwright screenshots attempt failed while Tauri/Vite already occupied port `5173`; rerunning screenshots after stopping the dev session passed.

## Build

```bash
npm run tauri:build
```

Tauri Linux dependencies are required for WebKitGTK and packaging. See `docs/INSTALLATION.md`.

## Linux Desktop Entry

Install helper:

```bash
bash scripts/install-desktop-entry.sh
```

The desktop file uses:

- `Name=Ailu AI Studio`
- `Exec=ailu-ai-studio`
- `Icon=ailu-ai-studio`
- `Categories=Development;IDE;Utility;`

## Roadmap

- Remember window size and position after the shell exposes a stable app settings path for that behavior.
- Add deep links only after route and session semantics are defined.
- Add release screenshots from intentional visual assets, not temporary test output.
- Keep package metadata aligned with implemented functionality.
