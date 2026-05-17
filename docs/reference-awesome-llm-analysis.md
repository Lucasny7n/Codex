# Awesome-LLM Reference Analysis

Reference: https://github.com/hannibal046/awesome-llm
Observed: 2026-05-17
License: CC0-1.0

## What Was Observed

- Awesome-LLM is a broad curated list with milestone papers, other paper lists, leaderboards, open LLMs, data, evaluation, training frameworks, inference, applications, tutorials, books and adjacent topic lists.
- The useful product lesson is taxonomy and discovery, not the raw volume of links.
- Its scale is appropriate for a reference repository, but too large for Ailu's desktop bundle and first-run UX.

## What Was Adapted For Ailu

- The Ailu catalog remains compact and original, but now has explicit metadata for:
  - `organization`;
  - `status`;
  - `updatedAt`;
  - category/type/difficulty/open-source/local-friendly/relevance.
- RAG and Agents are first-class categories instead of being hidden inside Applications.
- Search now considers organization and status metadata.
- Filters now include organization, popular tags, core resources and favorites-only mode.
- Added a small reviewed set of agent/RAG/code-evaluation resources instead of importing a giant list.

## What Was Not Imported

- No full Awesome-LLM table, README text, images or bulk resource list.
- No unreviewed long tail of resources.
- No claim that Ailu's catalog is exhaustive.
- No use of the LLM Library as installed-local-model truth; Ollama runtime remains the source of truth.

## License Risk

- Awesome-LLM is CC0-1.0. Even so, this pass used it only as taxonomy/reference inspiration.
- The shipped summaries and product metadata are original to Ailu.

## Next Steps

- Add resources only when they serve a real Ailu workflow.
- Add per-resource review status if the catalog grows beyond the current curated subset.
- Consider automated link checking later, but keep it outside normal app runtime.
- Add release screenshots for the Library only after final visual QA.
