# Ailu Sidecar

Este diretório contém os scripts do processo paralelo (sidecar) que o Ailu executa em segundo plano.
Atualmente focado em habilitar inferência pesada com pouca VRAM via AirLLM.

## Como configurar o ambiente (VENV)

NADA é instalado sem sua aprovação via Approval Modal do Ailu. O plano gerado executará:
1. `python3 -m venv ~/.local/share/ailu/airllm-venv`
2. `~/.local/share/ailu/airllm-venv/bin/pip install --upgrade pip`
3. `~/.local/share/ailu/airllm-venv/bin/pip install -r requirements-airllm.txt`

## Como testar comandos

Verificar status (mesmo sem AirLLM):
`python3 ailu_runtime.py status`

Testar geração (se AirLLM configurado):
`python3 ailu_runtime.py generate --model ~/.local/share/ailu/models/Qwen2.5 --prompt "Olá"`

Listar modelos:
`python3 ailu_runtime.py list-models --models-dir ~/.local/share/ailu/models`

## Onde ficam os modelos locais?
Por padrão em `~/.local/share/ailu/models`. Você precisa baixar manualmente ou via comandos autorizados do Ailu para esta pasta. Cada modelo deve estar em sua própria sub-pasta (ex: `.../models/Qwen2.5/`).

## Limitações atuais
- A geração neste sidecar está sendo refinada para evitar bloqueios de sistema por OOM no ambiente local, atualmente barrada no momento de invocar AutoModel se não for segura.
