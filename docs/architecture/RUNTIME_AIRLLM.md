# Runtime AI (AirLLM & Sidecar)

## Funcionamento do Sidecar Python
Como o Ailu V1 foca na performance extrema com modelos de ponta, rodar modelos 70B+ em placas com 8GB/12GB/24GB exige offload eficiente. A solução nativa adotada será o **AirLLM** em um processo isolado (Sidecar Python) gerenciado pelo Rust.

## Path e Inicialização
1. O Rust detecta o ambiente Python `python3.10+`.
2. Se não houver, pede `Approval` para criar `~/.local/share/ailu/airllm-venv`.
3. O Sidecar se comunica via `stdin`/`stdout` JSON lines.

## Comandos do Sidecar
- `load_model(path, kwargs)`
- `unload_model()`
- `stream_prompt(prompt, settings)` -> Envia yields parciais
- `get_vram_usage()`

## Fallbacks
Se AirLLM não estiver disponível ou for desativado, o Ailu suportará:
1. Ollama (chamada direta à API `http://127.0.0.1:11434`).
2. Llama.cpp / LM Studio.
