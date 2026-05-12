# Guia de Uso

Codex Command Center é uma central desktop para conversar com modelos locais via Ollama e providers de IA na nuvem com estado real de configuração.

## Abrir o app

```bash
npm run tauri dev
```

Para frontend isolado:

```bash
npm run dev
```

## Escolher ambiente

Use o seletor principal para alternar entre:

- `Nuvem`: providers cloud autenticados e testados.
- `Local`: modelos Ollama instalados e testados.

Um provider sem API key/login válido não é pronto. Um modelo local não instalado aparece como candidato para baixar.

## Chat normal

1. Escolha provider/modelo.
2. Envie a primeira mensagem.
3. O app cria ou atualiza a sessão.
4. A resposta vem do provider/modelo real ou retorna erro classificado.

Sessões podem ser renomeadas, duplicadas, exportadas, arquivadas ou excluídas.

## Bate-papo temporário

O modo temporário usa o mesmo provider/modelo selecionado, mas não grava sessão, histórico ou anexos. Ao sair do modo, o conteúdo é descartado.

## Anexos

Use o botão de arquivo no composer para anexar conteúdo. O app exibe chips e preview limitado quando seguro. Conteúdo grande ou não textual deve ser tratado como metadata, não despejado no campo de texto.

## Modelos locais

O modo Local depende de Ollama:

```bash
ollama list
curl -s http://127.0.0.1:11434/api/tags
```

Baixar, remover e testar modelos deve acontecer com feedback real. O app não instala modelos silenciosamente.

## Providers cloud

Configure credenciais pelo fluxo do provider/profile. Depois use `Testar conexão`. Credencial salva sem teste permanece em configuração/teste e não deve liberar seleção.

## STT / microfone

O microfone depende de permissão do WebView, captura de áudio, `ffmpeg`, backend local e modelo de transcrição. Falhas devem indicar qual parte está ausente.

## Permissões e comandos

Ações sensíveis precisam de aprovação explícita. O app não coleta senha e não usa `sudo -S`. Fluxos privilegiados dependem do helper dedicado e da allowlist documentada em `docs/PERMISSIONS.md`.

## Health Check

Use a área de saúde para diagnosticar provider, Ollama, storage, WebView, STT e permissões sem depender de terminal externo.
