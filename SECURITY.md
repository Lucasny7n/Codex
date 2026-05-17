# Security Policy

Security reports are handled privately. Do not open a public issue for vulnerabilities, leaked credentials, authentication bypasses or unsafe command/file execution paths.

## Reporting a Vulnerability

Open a private GitHub security advisory for this repository if available, or contact the maintainer directly with:

- affected commit or version;
- affected area;
- reproduction steps;
- impact;
- logs or screenshots with secrets redacted;
- suggested mitigation if known.

Do not include real API keys, OAuth tokens, private files or exploit details in public issues, screenshots or PR descriptions.

## Supported Versions

| Version | Support |
| --- | --- |
| `main` | Active development support |
| `0.1.x` | Best-effort while the project is pre-1.0 |
| Older snapshots | Not supported unless maintainers explicitly backport |

## Secrets and BYOK

Ailu is a bring-your-own-key app for cloud providers. The expected security posture is:

- keys are masked in the UI;
- saved credentials are not treated as `ready` until tested;
- raw provider payloads and stack traces are not shown by default;
- `.env`, local databases, screenshots, logs and test output must not contain secrets;
- localStorage must not be used for raw provider keys when the backend credential abstraction is available.

## Local Runtime

Local AI means Ollama runtime state. Ailu must not silently install Ollama, pull models or treat static catalog entries as installed models. Downloads and installs require explicit user action.

## Command and File Actions

Risky actions should have clear permission categories, target paths, impact, rollback when available and a cancel path. Privileged actions require explicit approval and must never use `sudo -S`.

See [docs/security.md](docs/security.md) for the engineering rules behind this policy.
