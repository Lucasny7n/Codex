# ADR 0001: Heavy-model runtime policy (RX 7600 / Arch Linux)

## Status
Accepted (Phase 1 foundation)

## Decision
- Ailu does **not** claim interactive performance for 70B+ models on the target hardware.
- 70B+ class runs are labeled **Heavy / brute-force / very slow**.
- Local design assumption is **one local model loaded at a time** on 16GB RAM class systems.
- AirLLM is intentionally **unsupported** in Ailu.

## Rationale
- Target hardware is AMD RX 7600 8GB VRAM + 16GB RAM + swap.
- This is practical for 7B/8B quantized models, tighter for 14B, and heavy/experimental beyond that.
- AirLLM is CUDA/NVIDIA-centric and not a good default for Arch + AMD interactive desktop use.

## Runtime direction
- Local runtime today: Ollama with real readiness probes.
- Future sidecar direction: llama.cpp server with Vulkan-first default for AMD.
- ROCm remains advanced/experimental until runtime probes prove real offload.
