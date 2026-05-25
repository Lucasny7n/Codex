# Changelog

All notable changes to Ailu AI Studio are tracked here. The format follows the spirit of Keep a Changelog, and this project uses Conventional Commits.

## Unreleased

### Added

- Professional GitHub landing page with centered project identity, real badges, screenshots, status table, quick start and documentation map.
- Root open-source docs: `CONTRIBUTING.md`, `SECURITY.md`, `SUPPORT.md`, `ROADMAP.md` and repository maintenance guides.
- GitHub issue forms, pull request template, Dependabot configuration, CODEOWNERS and CI hygiene checks.
- Intentional README screenshots under `docs/assets/screenshots/`.
- Repository audit and Terax GitHub-polish reference notes.

### Changed

- Hardened `.gitignore` and added `.gitattributes` for LF normalization, generated schema marking and binary asset handling.
- Refined README language to separate implemented, experimental and planned capabilities.
- Updated third-party credit policy to distinguish inspiration from copied assets or text.

### Security

- Added clearer policy for private vulnerability reporting, BYOK handling and local runtime install boundaries.

## 0.1.0 - 2026-05-17

### Added

- LLM Library with curated catalog, search, filters, favorites and workspace actions.
- AI Workspace with local planning, approvals, provider status, file context staging, markdown export and runtime notes.
- Responsive layout modes for comfortable, compact and focus workflows.
- Tauri window configuration for a `1440x900` default desktop app with `900x600` minimum size.
- Initial public docs for architecture, providers, desktop app, security, responsive QA and upgrade status.

### Notes

- File Context is local staging, not backend indexing.
- Terminal, editor and web preview surfaces remain experimental until backend integration is complete.
- Cloud providers require real credentials and validation before `ready`.
