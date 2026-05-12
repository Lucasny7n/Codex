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

Ollama é a única fonte local ativa. A UI local sem busca mostra somente modelos instalados confirmados por `/api/tags` ou, como fallback diagnóstico, `ollama list`.

Com busca, o app não consulta uma lista fixa como fonte de verdade. Ele normaliza o texto (`gpt oss`, `gpt-oss`, `gpt_oss`, `gptoss`) e, se não houver modelo instalado correspondente, oferece uma ação explícita:

```text
Baixar gpt-oss pelo Ollama
```

O teste remoto é o próprio `ollama pull <nome>`. Depois do pull, o app recarrega o snapshot do Ollama e só marca instalado se o modelo aparecer de verdade em `/api/tags` ou `ollama list`.

O registry local pode continuar existindo para sugestões, recomendações e documentação de famílias, mas ele não limita a descoberta local nem decide instalação.

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
curl -s http://127.0.0.1:11434/api/tags
ollama list
```

Operações usadas pelo app:

```bash
ollama list
ollama show <modelo>
ollama pull <modelo>
ollama rm <modelo>
```

Para ficar pronto, um modelo precisa aparecer em `/api/tags`/`ollama list` e passar por geração curta via API local.

Erros de pull são classificados para a UI:

- modelo não encontrado;
- sem internet ou registry indisponível;
- Ollama offline;
- permissão;
- disco insuficiente;
- erro desconhecido.
