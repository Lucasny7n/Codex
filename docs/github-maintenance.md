# GitHub Maintenance

This guide keeps the public repository consistent after the initial polish pass.

## Repository Metadata

Recommended description:

```text
Desktop AI workspace for local-first planning, LLM discovery, provider setup, and responsive AI workflows.
```

Recommended topics:

- `tauri`
- `react`
- `typescript`
- `rust`
- `ai`
- `llm`
- `desktop-app`
- `local-first`
- `developer-tools`
- `ai-workspace`

If `gh` is authenticated:

```bash
gh repo edit Lucasny7n/ailu-ai-studio --description "Desktop AI workspace for local-first planning, LLM discovery, provider setup, and responsive AI workflows."
gh repo edit Lucasny7n/ailu-ai-studio --add-topic tauri --add-topic react --add-topic typescript --add-topic rust --add-topic ai --add-topic llm --add-topic desktop-app --add-topic local-first --add-topic developer-tools --add-topic ai-workspace
```

Do not invent a homepage until there is a real site or release page worth linking.

## Branch Protection

Recommended for `main`:

- require pull request before merge;
- require CI status checks: `Frontend`, `Rust`, `Security Hygiene`;
- allow `Visual smoke` as manual/non-blocking unless CI capacity changes;
- require conversation resolution;
- prefer squash merge for focused history;
- block force pushes.

This pass does not configure branch protection automatically because it may require repository admin API permissions.

## Labels

Recommended labels:

| Label | Color |
| --- | --- |
| `type: bug` | `d73a4a` |
| `type: feature` | `a2eeef` |
| `type: docs` | `0075ca` |
| `type: refactor` | `5319e7` |
| `type: test` | `1d76db` |
| `type: chore` | `cfd3d7` |
| `area: ai-workspace` | `0b7cff` |
| `area: llm-library` | `0e8a16` |
| `area: desktop` | `fbca04` |
| `area: ui` | `bfd4f2` |
| `area: docs` | `0075ca` |
| `area: ci` | `5319e7` |
| `priority: high` | `b60205` |
| `priority: medium` | `fbca04` |
| `priority: low` | `0e8a16` |
| `status: blocked` | `b60205` |
| `status: needs-info` | `d4c5f9` |
| `good first issue` | `7057ff` |

Create labels manually or with the GitHub API after confirming auth.

## Screenshots

Refresh screenshots intentionally:

```bash
npm run screenshots
```

Promote only stable images into:

```text
docs/assets/screenshots/
```

Use these names for README assets:

- `ailu-home.png`
- `ailu-ai-workspace.png`
- `ailu-llm-library.png`
- `ailu-responsive.png`

Never commit raw `test-results/` output.

## Dependabot

Dependabot is configured weekly for npm, Cargo and GitHub Actions. Review dependency PRs in small batches and run:

```bash
npm install
npm run lint
npm run typecheck
npm run test -- --run
npm run build
cd src-tauri
cargo check
cargo test
```

## Release Checklist

Use [docs/release-process.md](docs/release-process.md) for tags and release notes. Keep `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` and `CHANGELOG.md` aligned.
