# Roadmap

This roadmap is intentionally honest. Nothing is considered done until it is validated in runtime and tests.

## P0 (current foundation)
- Honest local/cloud split with real readiness validation.
- Hardware detection (RAM, swap, VRAM when available, disk, AVX2, filesystem hints).
- Model memory estimator with explicit fit labels.
- Basic model manager behavior around real installed local models.

## P1
- Heavy mode UX with explicit confirmation and measured speed history.
- Deterministic skill foundation with approval model.
- File/config rollback records where reliable backups are possible.

## P2
- Voice approval UX.
- More curated safe skills.
- Advanced runtime sidecars (llama.cpp server path).

## Deferred / No
- AirLLM integration (unsupported by product direction).
- Automatic arbitrary shell operator from LLM output.
- Two simultaneous local models on 16GB RAM class hardware.
- Any claim that 70B+ is interactive on target hardware.
