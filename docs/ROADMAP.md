# Roadmap

This roadmap is intentionally honest. Items here are not implemented until the app, tests and docs prove them.

## Near term

- Keep hard Cloud/Local model separation covered by tests.
- Improve guided recovery for Ollama offline, missing model and API unreachable states.
- Keep STT backend status separate from microphone capture status.
- Add more visual smoke coverage for home, chat, model selector, settings, health and STT modal.
- Reduce `src/app/App.tsx` into smaller hooks and domain modules without changing behavior.

## Mid term

- Native keyring integration for provider profile secrets.
- Stronger provider adapter matrix with real auth checks.
- Better model comparison workflow with explicit user action and clear cost boundaries.
- Release packaging for common Linux formats.

## Out of scope until explicitly implemented

- Silent model downloads.
- Local runtimes other than Ollama as active model sources.
- Fake providers or fake chat responses in production flow.
- Root command execution without a reviewed privileged helper path.
- Public claims that cloud/STT features work without validation evidence.
