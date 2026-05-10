# Modelos e Providers

## Regra Principal

Catálogo não é suporte ativo. Um modelo só fica selecionável quando o provider/runtime está configurado e testado.

## Estados

- `ready`: testado e selecionável.
- `testing`: credencial salva, mas conexão ainda precisa ser testada.
- `requires_api_key`: falta API key.
- `requires_login` / `requires_cli_auth`: falta login ou auth CLI.
- `model_missing`: runtime existe, mas o modelo local não está instalado.
- `service_offline`: runtime instalado, mas serviço parado.
- `api_unreachable`: serviço existe, mas API local não respondeu.
- `experimental`: catalogado, mas adapter ainda não deve executar.
- `unavailable`: provider/runtime indisponível no build atual.

## Cloud

Providers organizados no catálogo:

- OpenAI
- OpenRouter
- Google/Gemini
- Anthropic
- Groq
- Mistral
- Together AI
- Fireworks AI
- Cerebras
- DeepSeek
- xAI
- Perplexity
- Cohere como experimental quando o adapter dedicado não estiver validado

API key fica no modal do modelo/provider específico aberto pelo botão `...` do seletor. Salvar chave não marca o provider como pronto; o teste de conexão precisa retornar sucesso.

## Local

Runtime ativo hoje:

- Ollama

Famílias no catálogo local:

- Qwen e Qwen Coder
- Llama
- Mistral e Mixtral
- DeepSeek e DeepSeek Coder
- Gemma
- Phi
- Yi
- StarCoder
- CodeLlama
- Nous/Hermes
- Dolphin
- OpenChat
- TinyLlama

Modelos locais não instalados aparecem com ação de download. O app não baixa nada automaticamente e não usa sudo sem confirmação.

## Multimodal e Imagem

O catálogo já possui campo de modalidade:

- `text`
- `code`
- `vision`
- `image_generation`
- `audio_transcription`

Geração de imagem não está ativada nesta passada. Esses campos existem para preparar UI, filtros e adapters futuros sem poluir a tela atual.

## Ollama

Diagnóstico esperado:

```bash
command -v ollama
systemctl is-active ollama
ollama list
```

Para ficar pronto, um modelo precisa aparecer em `ollama list` e passar por geração curta via API local.
