---
title: "ADR 013: MCP Servers as the AI-Operations Interface"
eyebrow: Architecture Decision Record
summary: Eleven in-cluster MCP servers give AI tooling structured, scoped access to platform APIs — instead of pasted terminal output or raw credentials.
permalink: /architecture/decisions/013-mcp-ai-operations/
---

**Status:** Accepted &nbsp;·&nbsp; **Date:** Mar 2026 &nbsp;·&nbsp; [← All ADRs](../../)

---

## Context

AI assistants became genuinely useful for operating this platform once they could see it — my [AI-assisted engineering notes](../../../copilot-experiments/) call cluster-specific context the difference between generic answers and correct ones. The question was *how* to grant that access:

- **Paste terminal output into chat** — works, tedious, and the model only sees what I think to show it.
- **Hand the assistant raw credentials** (a kubeconfig, a Vault token) — maximum capability, zero containment, and credentials sprawled onto every laptop.
- **Model Context Protocol servers** — a structured tool interface per system, with credentials held server-side and scoped per target.

## Decision

**Eleven MCP servers run in the cluster** — Kubernetes, ArgoCD, Gitea, Vault, MinIO, CloudNativePG, Talos, Authentik, Synology, Unifi, and Paperless — each a small Deployment in a dedicated namespace. Design rules:

- **Credentials never leave the cluster.** Each server authenticates to its target with a dedicated credential delivered by ESO from Vault ([ADR 003](../003-vault-external-secrets/)). The AI client talks to the MCP endpoint; it never holds a platform secret.
- **Least privilege per target, where the target allows it.** The Kubernetes server runs under a ClusterRole limited to `get`/`list`/`watch` — read-only by construction. The ArgoCD server uses a dedicated service account whose RBAC permits viewing and syncing applications, nothing else.
- **The namespace is locked down**: no-internet egress lane ([ADR 008](../008-cilium-cni/)), default-deny ingress, and an Istio AuthorizationPolicy admitting only the ingress gateway.
- Where an off-the-shelf server only speaks stdio, a small **gateway wrapper** converts it to streamable HTTP — those custom images are built and published by the in-cluster CI ([ADR 002](../002-self-hosted-gitea-ci/)).

## Reasoning

- **Capability without credential sprawl** is the entire trade. Revocation is central; rotation is a Vault edit.
- **The assistant sees ground truth**, not my summary of it — live ArgoCD sync states, actual Talos node health, real Vault mount configuration.
- **Each endpoint is monitored** like any other platform service (they account for a healthy fraction of the uptime monitors).

## Tradeoffs

- **Not everything is read-only.** Some servers expose mutating operations, and per-*tool* authorization within a server is coarse. The current containment is authentication scoping plus network policy — honest gap: a malicious or confused client with mesh access to a write-capable server can do write-capable things.
- **I built the governance layer, then learned it was the wrong shape.** [Policyclaw](../../../projects/policyclaw/) — a custom Go MCP gateway with an OPA sidecar — routed all eleven servers through per-backend risk tiers: read-only calls passed, mutating calls required explicit human confirmation. It worked. But a gateway you have to route through is opt-in governance — it protects you only as long as nothing talks to an MCP server directly. That judgment belongs *inside* the collaborator as an invariant, not beside it as a proxy, which is exactly what [Cortexa](../../../projects/cortexa/)'s code-owned approval handshake does. So the MCP servers stay — they're the live agency layer — while Policyclaw's confirmation-gate idea (and the agent-runtime experiments, Openclaw and Hermes) graduate into Cortexa rather than run as standalone boxes. For now the containment on the raw MCP layer is authentication scoping plus network policy, and I'm honest above about that gap.
- **Eleven more deployments** to patch, monitor, and occasionally debug.

## Outcome

Troubleshooting sessions now start with the assistant querying the actual system instead of me transcribing it — the workflow the copilot-experiments page describes as the single biggest context unlock. The MCP layer is here to stay; the [Policyclaw](../../../projects/policyclaw/) prototype stands as the working proof of where the *governance* goes next: policy-mediated, confirmation-gated AI operations, built into [Cortexa](../../../projects/cortexa/) as an invariant rather than bolted on as a separate box.


<div class="adr-nav">
  <a href="../012-layered-backup-strategy/">&larr; ADR 012 &middot; Layered backup strategy</a>
  <a class="adr-nav-all" href="../../">ADR 13 of 14</a>
  <a href="../014-vllm-inference/">ADR 014 &middot; vLLM for served generation &rarr;</a>
</div>
