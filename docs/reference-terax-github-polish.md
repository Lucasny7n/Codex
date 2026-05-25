# Terax GitHub Polish Reference

Observed: 2026-05-17
Reference: https://github.com/crynta/terax-ai
License: Apache-2.0

## Patterns Observed

- Clear centered README identity with logo, product name, tagline and badges.
- Concise product positioning before implementation details.
- Screenshots near the top of the README.
- Features grouped by product surface instead of one long bullet list.
- Honest platform notes and build-from-source instructions.
- Root-level contribution, conduct, security and license files visible in GitHub's repository sidebar.
- Topics, releases and package metadata used to make the repository feel maintained.
- AI configuration described as a user setup flow, not as a hidden terminal-only process.

## Adapted for Ailu

- README now starts with Ailu's own logo, name, tagline and real project badges.
- Screenshots are promoted as intentional release assets under `docs/assets/screenshots/`.
- Feature grouping follows Ailu's actual surfaces: AI Workspace, LLM Library, Providers/BYOK, Desktop/Layout and Security/Privacy.
- Status table separates implemented, experimental and planned work.
- Quick start, validation and tech stack use Ailu's real npm, Tauri and Cargo commands.
- Root docs and `.github` templates are added for open-source discoverability.
- GitHub maintenance and release process docs explain labels, branch protection and screenshot refresh.

## Rejected

- No Terax branding, screenshots, logo, copy or source files were copied.
- Ailu does not claim Terax-level terminal/editor/web-preview parity.
- Ailu keeps Ollama as the only local model runtime instead of adopting Terax's local-provider choices.
- Ailu keeps its black/End-4 blue identity instead of copying another visual system.
- Ailu does not claim tiny bundle size, platform support or keychain behavior beyond what is implemented.

## Inspiration Boundary

This work used Terax as a public benchmark for repository presentation and open-source hygiene. The implementation, README copy, screenshots, docs and assets are original to Ailu. If future changes copy implementation details, assets or substantial text, update `THIRD_PARTY.md`, `docs/credits.md` and any required notices before merging.
