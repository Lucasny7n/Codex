# Ollama

Ollama is the only active local model runtime in Ailu AI Studio.

## Diagnose Ollama

```bash
command -v ollama
ollama --version
ollama list
curl -s http://127.0.0.1:11434/api/tags
```

If `ollama list` works but `/api/tags` fails, check the service and port `11434`.

## Local picker behavior

- Local without search shows installed Ollama models only.
- Local search checks installed models, Ollama discovery and curated fallback candidates.
- `gpt oss`, `gpt-oss`, `gpt_oss` and `gptoss` normalize to `gpt-oss`.
- Human searches such as `qwen coder`, `llama`, `deepseek r1` and `gemma` should find useful Ollama candidates.
- A candidate shows `Download`, not `Installed`.
- A model is installed only if it appears in `ollama list` or `/api/tags`.

## Pull a model manually

```bash
ollama pull <model>
```

Large downloads should be intentional. Ailu does not silently pull large models.

## Test a model

```bash
curl -s http://127.0.0.1:11434/api/generate \
  -d '{"model":"<model>","prompt":"ping","stream":false}'
```

The app uses a short runtime test before treating a local model as usable.

## Remove a model

```bash
ollama rm <model>
```

Refresh the app snapshot after removal.

## Common states

- `not_installed`: Ollama is missing.
- `service_offline`: the service is not active.
- `api_unreachable`: local API is not responding.
- `model_missing`: the requested model is not installed.
- `pulling`: download is in progress.
- `ready`: runtime and selected model are usable.
