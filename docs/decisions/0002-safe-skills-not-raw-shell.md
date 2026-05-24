# ADR 0002: Safe skills instead of raw arbitrary shell

## Status
Accepted (Phase 1 policy/docs)

## Decision
- Ailu does not treat LLM-generated arbitrary shell as the default operator path.
- Product direction favors deterministic, inspectable skills with explicit approval.
- Safety policy remains strict for privileged/unsafe actions and forbids `sudo -S`.

## Rationale
- Arbitrary shell generation is hard to audit and easy to misuse.
- Deterministic skills are reviewable, versionable, and safer for repeated operations.
- This keeps local assistant behavior honest and aligned with explicit user control.

## Scope note
- Phase 1 records architecture and constraints only.
- Full skill runner lifecycle is scheduled for later phases.
