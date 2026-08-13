---
title: "ADR 014: vLLM for Served Generation, Alongside Ollama"
eyebrow: Architecture Decision Record
summary: A second inference runtime for throughput — vLLM serving a quantized 30B tensor-parallel across both GPUs, with Ollama kept for embeddings and flexible experimentation.
permalink: /architecture/decisions/014-vllm-inference/
---

**Status:** Accepted — rollout in progress &nbsp;·&nbsp; **Date:** Aug 2026 &nbsp;·&nbsp; [← All ADRs](../../)

---

## Context

[ADR 011](../011-local-llm-inference/) established local inference on **Ollama**, and that was the right call to start: trivial model management, one-line model swaps, and more than good enough for interactive chat and document Q&A.

Then the workloads changed shape. Agentic loops and — especially — [Cortexa](../../../projects/cortexa/)'s evaluation harness aren't latency-bound the way a single chat is; they're **throughput-bound**. A full eval run is ~150 sequential model calls, all serialized on one GPU, and Ollama serves essentially one request at a time. Two things I wanted, Ollama doesn't do well:

- **Concurrency** — many in-flight requests batched together, not queued one behind another.
- **Both GPUs on one model** — tensor parallelism across the pair of RTX 3060s, rather than one card doing the work.

## Decision

Run **vLLM** as the **served-generation** runtime, and keep **Ollama** for everything else — a split by job, not a straight replacement.

- **vLLM** (`vllm/vllm-openai:v0.26.0`) serves `Qwen3-Coder-30B-A3B-Instruct-AWQ` (as `qwen3-coder-30b`), **tensor-parallel across both RTX 3060s** (`--tensor-parallel-size=2`), AWQ-quantized to fit a 30B MoE in 24 GB. OpenAI-compatible API at `vllm-service.vllm.svc.cluster.local:8000`, externally at `vllm.private.gawarecki.us`.
- **Ollama stays, split by role.** A CPU-only `ollama-cpu` now serves embeddings (`nomic-embed-text`); the GPU Ollama deployment is scaled to zero and brought up only for bulk re-embeds. Because vLLM and GPU-Ollama each claim *both* cards and GPU time-slicing was rejected, **only one GPU generation workload runs at a time** — the two runtimes divide the work, they don't share the silicon.

## Reasoning

- **Throughput via continuous batching.** vLLM's PagedAttention + `--max-num-seqs=16` keeps the GPUs busy across concurrent requests instead of idling between serialized calls — directly aimed at the eval-harness and multi-agent workloads.
- **Full GPU utilization.** `--tensor-parallel-size=2` puts both 3060s on one model; AWQ quantization is what makes a 30B fit at all on 24 GB.
- **OpenAI-compatible API.** A drop-in `/v1` surface that standard SDKs and clients expect. The external gateway is provisioned specifically so Cortexa can reach it.
- **Ollama earned its keep for the rest.** Embeddings and quick model experimentation want Ollama's flexibility; generation wants vLLM's throughput. Keeping both is cheaper than pretending one tool is best at both.

## Tradeoffs

- **Less model flexibility — which is *why* Ollama stays.** vLLM is effectively one model per server, with a heavy startup (torch.compile, a ~20 GB first-run download, ~90 s init). Swapping models is nothing like Ollama's one-liner. The coexistence isn't hedging; it's using each tool where it's strong.
- **The two can't share the GPUs.** Both want both cards, and time-slicing was rejected, so GPU generation is vLLM *or* GPU-Ollama — never both at once. Embeddings had to move to CPU to free the cards for vLLM.
- **More knobs, and sharp ones.** `--gpu-memory-utilization=0.93` (0.90 OOMed during CUDA-graph capture on 12 GB cards), `NCCL_P2P_DISABLE=1` (no NVLink on consumer 3060s), and a 1 GiB `/dev/shm` because the 64 MB default breaks NCCL all-reduce. Ollama needed none of this.
- **Weights on hostPath, not the SAN.** Talos `/var/mnt` is read-only and the Ollama UserVolume was too small, so model weights live on a `hostPath` at `/var/lib/vllm-models` (~96 GiB ephemeral on the node). A node rebuild re-downloads ~20 GB — a deliberate, documented departure from the platform's usual PVC-on-Synology pattern ([ADR 005](../005-synology-iscsi-storage/)).
- **No egress policy yet.** The `vllm` namespace has no Cilium lane ([ADR 008](../008-cilium-cni/)). It needs outbound access to pull weights from HuggingFace on first run, but "no policy" means unrestricted egress — the right fix is a Lane-B FQDN allowlist for the HF endpoints, and it isn't in place.

## Outcome

vLLM is live and serving `qwen3-coder-30b` across both cards. But this is honestly recorded as **a migration in progress (Aug 2026), not a finished cutover.** The generation consumers — Open WebUI, paperless-ai, karakeep — still point at Ollama endpoints and haven't been repointed to vLLM's OpenAI API, so some currently have no generation backend during the transition. The external gateway is wired for Cortexa; the internal repointing (and the egress lane) is the open work.

I'm documenting it mid-flight on purpose. The tidy version — "migrated to vLLM" — would be a cleaner sentence and a less honest one. This is what the change actually looks like a few days in.


<div class="adr-nav">
  <a href="../013-mcp-ai-operations/">&larr; ADR 013 &middot; MCP for AI operations</a>
  <a class="adr-nav-all" href="../../">ADR 14 of 14</a>
  <span></span>
</div>
