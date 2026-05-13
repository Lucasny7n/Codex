# Quickstart

Run all commands from the repository root.

## 1. Install dependencies

```bash
npm install
```

## 2. Check the host

```bash
npm run doctor
```

The doctor prints missing tools and suggested commands. It does not run privileged package installation.

## 3. Start the app

Frontend only:

```bash
npm run dev
```

Desktop app:

```bash
npm run tauri:dev
```

## 4. Use Local AI

Install and start Ollama outside the app, then verify:

```bash
ollama list
curl -s http://127.0.0.1:11434/api/tags
```

Select `Local` in Ailu. Without search, the picker shows installed Ollama models only. Search can show download candidates, but they are not marked installed until Ollama confirms them.

## 5. Use Cloud AI

Select `Cloud`, open the model configuration, add an API key/profile and run `Test key` or `Test connection`. A saved key without a successful test is not treated as ready.

## 6. Validate your checkout

```bash
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm run icons:validate
git diff --check
cd src-tauri
cargo fmt --check
cargo check
cargo test
```

For UI work also run:

```bash
npm run screenshots
npm run test:visual
```
