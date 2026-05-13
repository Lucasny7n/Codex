# Troubleshooting

## Ollama offline

Valide:

```bash
command -v ollama
ollama --version
ollama list
curl -s http://127.0.0.1:11434/api/tags
```

Se a CLI existe mas a API não responde, verifique o serviço local e a porta `11434`.

## Modelo local não aparece

- Confirme o nome em `ollama list`.
- Rode `curl -s http://127.0.0.1:11434/api/tags`.
- Use o nome completo com tag quando necessário, por exemplo `qwen2.5-coder:7b`.
- Depois de baixar, atualize o snapshot no app.

## STT sem permissão

- Verifique se o WebView expõe `navigator.mediaDevices`.
- Conceda permissão de microfone.
- Confirme PipeWire/WirePlumber/portal no host.
- Valide `ffmpeg -version`.
- Configure backend Whisper/Vosk e modelo local.

## Ícone não aparece no Hyprland

Rode:

```bash
npm run icons:validate
bash scripts/install-desktop-entry.sh
```

Confirme que o desktop entry aponta para `Icon=ailu-ai-studio` e que os PNGs existem em `~/.local/share/icons/hicolor`.

## Porta Vite ocupada

O Vite usa `5173` com `strictPort`. Verifique o processo antes de concluir falha do app:

```bash
lsof -n -P -iTCP:5173 -sTCP:LISTEN
```

## Provider com API inválida

- Reconfigure a API key no provider/profile correto.
- Use `Testar conexão`.
- Verifique status HTTP: `401` indica chave inválida; `403` indica acesso negado; `429` indica cota ou limite; `5xx` indica falha temporária do provider.
- Não force seleção quando o status não for `ready`.
