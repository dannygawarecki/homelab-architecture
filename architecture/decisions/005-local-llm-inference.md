# ADR 005: Local LLM Inference with Ollama on a Dedicated GPU Worker

**Status:** Accepted  
**Date:** 2026

---

## Context

I wanted LLM capabilities available in the homelab — both for personal use (chat, document Q&A) and as a foundation for in-cluster AI agents. Options:

- **Cloud APIs (OpenAI, Anthropic, Google)** — low friction, always up to date, no hardware investment. But every prompt leaves the network, costs accumulate, and rate limits constrain agentic workloads.
- **Consumer AI devices (e.g. AI PCs, Apple Silicon)** — capable, but not Kubernetes-native and not easily integrated into cluster workloads.
- **GPU passthrough into a VM** — possible, but keeps the inference stack outside the cluster and requires separate orchestration.
- **Dedicated GPU Kubernetes worker with Ollama** — inference runs inside the cluster, accessible to all workloads as a standard service endpoint, no data leaves the network.

The workloads I had in mind — MCP servers, in-cluster agents (Hermes), policy enforcement (Policyclaw) — all benefit from low-latency access to an LLM that doesn't require an API key rotation strategy or a credit card.

---

## Decision

Dedicate one Kubernetes worker node (`kube-worker-ai`) to GPU workloads. Use **Ollama** as the model serving runtime, exposed as an in-cluster service. All LLM-dependent workloads point at `ollama-service.ollama.svc.cluster.local`.

---

## Reasoning

- **Data stays in the network.** Prompts from agents, documents from Paperless, and reasoning traces from Hermes never leave the homelab. This is the primary driver.
- **No per-token cost.** Agentic workloads are prompt-heavy. Cloud API costs for continuous agent loops would be significant; local inference has a fixed hardware cost that's already paid.
- **First-class cluster citizen.** Ollama runs as a standard Kubernetes Deployment, managed by ArgoCD, with resource limits via the NVIDIA device plugin. Any pod in the cluster can reach it without special credentials.
- **Model flexibility.** Swapping or running multiple models is a config change. No vendor lock-in, no API compatibility concerns.
- **GPU passthrough through Proxmox → Talos → NVIDIA device plugin** is non-trivial but reproducible. The investment in getting this stack right pays dividends for every AI workload running on top of it.

---

## Tradeoffs

- **Hardware investment.** A second-hand HP Z440 with dual RTX 3060s was a deliberate purchase. The VRAM ceiling (12GB per GPU) constrains which models can run at full precision.
- **GPU passthrough complexity.** PCIe passthrough through Proxmox, NVIDIA kernel extensions in Talos, the device plugin in Kubernetes, and CUDA within Ollama — four layers to get right and four layers that can break independently.
- **Single point of failure for AI workloads.** If the GPU worker is down, all LLM-dependent services degrade. Acceptable for a homelab; would require a different answer at scale.
- **Model quality gap.** Local models (Qwen, Llama, Mistral) are good and improving fast, but for some tasks cloud models are still meaningfully better. The tradeoff is accepted.

---

## Outcome

The GPU worker runs stably with Ollama serving models at `ollama-service.ollama.svc.cluster.local:11434`. Hermes, Policyclaw, and Open WebUI all consume it. The stack has survived Talos upgrades and node reboots without requiring manual intervention.
