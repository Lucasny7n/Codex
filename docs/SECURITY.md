# Security

Ailu AI Studio touches local files, provider credentials, AI runtimes and desktop services. Safety is part of the product, not a later cleanup.

## Secrets

- Never commit API keys, tokens, `.env` files or private local databases.
- Never print API keys in logs, screenshots, tests or UI errors.
- Store provider secrets through the credential store path, not raw JSON files in the repo.
- Display credentials only as masked labels.

## Provider readiness

- A saved key is not `ready`.
- A provider is `ready` only after a real connection test.
- Cloud models stay cloud-only.
- Ollama models stay local-only.

## Local files

Ignored by default:

- `node_modules/`
- `dist/`
- `src-tauri/target/`
- logs and temp test output
- screenshots from temp folders
- databases
- model weights and checkpoints

## Privilege

- `sudo -S` is forbidden.
- Scripts must not install packages with sudo silently.
- Setup scripts must print the command and ask before privileged install steps.
- Privileged app actions need explicit approval, risk and rollback.

## STT and audio

Microphone capture starts only after the user clicks the microphone or test recording button. Temporary audio must be deleted after transcription.

## Reporting issues

Open a security report without public exploit details. Include impact, environment, reproduction steps and redacted evidence.
