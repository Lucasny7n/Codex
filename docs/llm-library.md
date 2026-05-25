# LLM Library

The LLM Library is Ailu's curated knowledge hub for language model research and engineering.

## Goals

- Make LLM resources discoverable inside the app.
- Keep a compact, maintainable dataset instead of importing a giant list.
- Support practical filtering for local model users, provider selection and evaluation work.
- Integrate with AI workflows through context, explanation, comparison and planning actions.

## Data Source

Primary file:

```text
src/data/llm-resources.ts
```

Search/filter logic:

```text
src/lib/llmLibrary/search.ts
```

The initial taxonomy is inspired by public curated LLM repositories, but the shipped data is an original subset with Ailu-specific metadata and summaries.

## Resource Fields

Each resource includes:

- `id`
- `title`
- `category`
- `type`
- `provider`
- `organization`
- `year`
- `url`
- `tags`
- `summary`
- `difficulty`
- `isOpenSource`
- `localFriendly`
- `relevance`
- `status`
- `updatedAt`

## Categories

- Milestone Papers
- LLM Leaderboards
- Open LLMs
- LLM Data
- Evaluation
- Training Frameworks
- Inference
- Agents
- RAG
- Applications
- Tutorials & Courses
- Books
- Security
- Compression
- Code LLMs
- Multimodal
- Local Models

## UI Behavior

- Search across title, provider, organization, year, tags, category, status and summary.
- Filter by category, type, difficulty and organization.
- Toggle favorites-only, core, open-source and local-friendly filters.
- Use popular tag chips or card tags as quick filters.
- Favorite resources locally.
- Copy a reference.
- Open external source links.
- Send a resource to the chat as hidden context.
- Add a resource to the AI Workspace plan.

## V2 Scope

The V2 pass added first-class RAG and Agents categories, organization/status/update metadata, tag filters, favorites-only filtering and a small curated set of additional resources. It still avoids importing the full Awesome-LLM list.

## Adding Resources

1. Add a new entry to `llmResources`.
2. Keep the summary concise and original.
3. Use a stable `id` with lowercase letters, numbers and hyphens.
4. Prefer canonical project, paper or organization URLs.
5. Fill organization/status/update metadata explicitly only when the defaults are not enough.
6. Run:

```bash
npm run test -- tests/llm-library.test.ts --run
npm run typecheck
```

## Non-Goals

- Do not import the full Awesome-LLM list.
- Do not claim the catalog is exhaustive.
- Do not add paid-provider marketing entries without a product reason.
- Do not use the catalog as the source of truth for installed local models. Ollama runtime remains the source of truth for Local.
