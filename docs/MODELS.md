# Modelos

O app trabalha com dois modos explícitos: `Nuvem` e `Local`. Eles não compartilham status nem escondem falhas um do outro.

## Nuvem

Providers cloud vêm de adapters reais. Um provider só fica utilizável quando o método de autenticação exigido está completo e a conexão foi testada.

Estados comuns:

- `ready`: provider/profile/modelo testado e selecionável.
- `testing`: credencial salva ou validação em andamento; ainda não é pronto.
- `requires_api_key`: falta API key.
- `requires_login`, `requires_oauth`, `requires_cli_auth`: falta autenticação externa.
- `quota_exceeded` ou `rate_limited`: limite atingido.
- `provider_unavailable`: erro temporário do serviço.
- `misconfigured`: adapter ou configuração incompleta.
- `unavailable`: indisponível para uso.

Credencial salva sem teste não vira `ready`.

## Local

O modo Local usa Ollama real. O registry local serve para metadata, compatibilidade e sugestões, mas a fonte de verdade é o runtime Ollama.

Um modelo local só fica utilizável quando:

1. Ollama está instalado ou acessível.
2. A API local responde em `127.0.0.1:11434`.
3. O modelo aparece em `/api/tags` ou `ollama list`.
4. O teste curto de geração passa.

## Busca local

A busca aceita nomes livres como `gpt oss`, `llama3.2` e `qwen2.5-coder:7b`. Quando o modelo não está instalado, a UI cria um candidato para baixar. Esse candidato não é `ready`.

## Download e remoção

Comandos manuais equivalentes:

```bash
ollama pull <modelo>
ollama show <modelo>
ollama rm <modelo>
```

O app exibe progresso quando o backend recebe progresso real. Depois do download, o snapshot é recarregado; se o modelo não aparecer, a operação falha com erro claro.

## Regras de UI

- Instalado e testado: selecionável.
- Instalado sem teste: ação de testar.
- Baixando: progresso e ação bloqueada.
- Não instalado: candidato para baixar.
- Ollama offline: ação para iniciar/diagnosticar runtime.
- Provider cloud sem autenticação: ação para configurar credencial/login.

## Capacidades planejadas

Campos de metadata para multimodalidade e geração de imagem podem existir no código para preparar evolução futura. Isso não significa que geração de imagem esteja implementada no app.
