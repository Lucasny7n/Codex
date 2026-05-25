# Architecture

Ailu AI Studio is a Tauri 2 desktop application with a React/TypeScript frontend and Rust backend services.

## Product Shell

The app uses a three-part product model:

- left sidebar for conversations, projects and product navigation;
- center workspace for chat, LLM Library or AI Workspace;
- drawers/modals for settings, terminal, onboarding and focused configuration.

The visual identity remains Ailu's dark/blue desktop style. The responsive system adds density modes and viewport-aware classes instead of replacing the design.

## Frontend

- `src/app/App.tsx`: bootstraps state, routes major views and wires app actions.
- `src/components/layout`: topbar and shell layout.
- `src/components/panels`: sessions, settings-related panels, terminal drawer and support surfaces.
- `src/components/chat`: chat transcript, composer, attachments and STT flow.
- `src/components/library`: LLM Library UI.
- `src/components/workspace`: AI Workspace UI.
- `src/data`: curated product data such as the LLM catalog.
- `src/lib`: provider/model helpers, Ollama search, memory, file context, theme and utility services.
- `src/config`: feature flags, provider product policy and navigation configuration.
- `src/hooks`: shared frontend hooks such as viewport detection.

## Backend

- `src-tauri/src/services/provider_registry.rs`: provider profiles and runtime state.
- `src-tauri/src/services/provider_adapters.rs`: real provider calls.
- `src-tauri/src/services/credential_store.rs`: masked credential storage and profile state.
- `src-tauri/src/services/local_runtime.rs`: Ollama diagnostics, model install/remove/test.
- `src-tauri/src/services/permission_manager.rs`: action risk, approval and outcomes.
- `src-tauri/src/services/session_manager.rs`: session persistence, archive and export.
- `src-tauri/src/services/command_executor.rs`: controlled command execution.

## AI Workspace

The AI Workspace is intentionally a coordination surface, not a fake agent runtime. It shows:

- plan board persisted locally;
- provider readiness summary;
- pending approvals;
- changed file context;
- project memory location;
- terminal entrypoint;
- future web preview slot.

Command execution still routes through the existing permission/request path.

## LLM Library

The LLM Library is static curated product data with a typed search layer. It can send hidden context into the real chat pipeline, add tasks to the workspace plan, copy references and open canonical URLs.

## Feature Flags

Feature flags live in `src/config/features.ts` and are read from `VITE_AILU_*` env vars. Defaults keep current product surfaces enabled while leaving experimental agent tools disabled.

## Design Constraints

- Local and Cloud never mix.
- No fake provider readiness.
- No secrets in UI/logs/screenshots.
- Responsive changes must preserve current identity.
- Experimental modules must be labeled honestly.
