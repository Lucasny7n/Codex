# Segurança

Ailu AI Studio opera providers, arquivos locais, comandos e credenciais. Segurança e rastreabilidade têm prioridade sobre automação.

## API keys

- Nunca commitar API key, token, segredo ou arquivo `.env`.
- Nunca mostrar segredo completo na UI, log, screenshot ou mensagem de erro.
- API keys devem passar por `CredentialStore`.
- Credencial salva sem teste não significa provider pronto.

## Armazenamento de credenciais

O store atual mascara credenciais na UI e preserva status por provider/profile. Integração com keyring nativo permanece como evolução recomendada quando disponível.

## Git

Arquivos ignorados incluem:

- `.env`, `.env.*`.
- chaves e tokens.
- logs.
- bancos locais.
- modelos e pesos (`.gguf`, `.safetensors`, `.onnx`, `.pt`, `.pth`, `.ckpt`, `.bin`).
- screenshots e resultados temporários.

## Privilégio

- `sudo -S` é proibido.
- Nenhuma instalação ou ação root deve acontecer silenciosamente.
- Ações privilegiadas exigem aprovação explícita, risco, alvo e rollback.
- O helper privilegiado deve usar allowlist, não shell root arbitrário.

## Arquivos e anexos

- Preview de arquivo deve ter limite de tamanho.
- Diretórios e binários não devem ser enviados como texto bruto.
- Caminhos inacessíveis devem falhar com erro curto.
- Dados de anexo em modo temporário não devem persistir.

## Modo temporário

O modo temporário usa provider real, mas não grava sessão, histórico ou anexos. Ele não é modo anônimo de sistema; providers externos ainda podem processar o conteúdo enviado.

## Reportar falha de segurança

Abra uma issue privada ou entre em contato com o mantenedor antes de publicar detalhes exploráveis. Inclua impacto, passos mínimos, ambiente e evidência sem segredo.
