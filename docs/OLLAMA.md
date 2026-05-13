# Ollama

Ollama é a única fonte local ativa do Ailu AI Studio nesta versão.

## Diagnóstico rápido

```bash
command -v ollama
ollama --version
ollama list
curl -s http://127.0.0.1:11434/api/tags
```

Se `ollama list` funciona, mas a API não responde, verifique o serviço local e a porta `11434`.

## Listar modelos

```bash
ollama list
```

O app também consulta `/api/tags` para montar o snapshot de modelos instalados.

## Buscar modelo

Digite o nome no seletor Local ou no Model Manager. O app normaliza o texto e cria candidato para baixar quando o nome é aceito como entrada possível do Ollama.

## Baixar modelo

```bash
ollama pull <modelo>
```

No app, o download deve exibir progresso quando disponível. O modelo só fica instalado depois de novo snapshot confirmar a presença dele.

## Testar modelo

```bash
curl -s http://127.0.0.1:11434/api/generate \
  -d '{"model":"<modelo>","prompt":"ping","stream":false}'
```

O app usa teste curto para confirmar que o modelo responde antes de liberar seleção.

## Remover modelo

```bash
ollama rm <modelo>
```

Depois da remoção, o app recarrega o snapshot local.

## Estados

- `not_installed`: Ollama ausente.
- `service_offline`: serviço não responde.
- `api_unreachable`: API local indisponível.
- `model_missing`: modelo ainda não instalado.
- `downloading`: download em andamento.
- `ready`: runtime e modelo testados.

## Regras de segurança

O app não instala Ollama, runtime ou modelo sem confirmação. Downloads dependem de rede e disco local; erros devem mostrar causa provável e ação clara.
