---
title: Architecture
eyebrow: Platform
summary: The diagrams that describe the platform, and the decision records that explain why it looks the way it does.
permalink: /architecture/
layout: architecture
diagram_count: 4
diagram_thumb: /images/physical-architecture-v2.png
---

<p class="gh-only">Two parts: the <a href="./diagrams/">diagrams</a> (physical layout, network trust zones, platform capability map, delivery and inference flows) and the <a href="./decisions/">architecture decision records</a> below.</p>

## Every decision, in order

Every significant platform choice is written down as an ADR: the alternatives I actually considered, the reasoning, and — importantly — the tradeoffs I accepted rather than solved. These are the closest thing here to a design review.

The records are ordered as the platform came together — foundational choices first — and each one links to the next at its foot, so you can read the set straight through.

| ADR | Decision | Date |
|---|---|---|
| [001](./decisions/001-gitops-argocd/) | GitOps with ArgoCD — App of Apps pattern | Jul 2025 |
| [002](./decisions/002-self-hosted-gitea-ci/) | Self-hosted Gitea with in-cluster CI | Jul 2025 |
| [003](./decisions/003-vault-external-secrets/) | Vault + External Secrets Operator as the only secrets path | Aug 2025 |
| [004](./decisions/004-authentik-sso/) | Authentik as the identity provider | Aug 2025 |
| [005](./decisions/005-synology-iscsi-storage/) | Synology iSCSI via CSI as primary storage | Oct 2025 |
| [006](./decisions/006-proxmox-vms/) | Kubernetes nodes as Proxmox VMs, not bare metal | Nov 2025 |
| [007](./decisions/007-talos-linux/) | Talos Linux as the Kubernetes OS | Nov 2025 |
| [008](./decisions/008-cilium-cni/) | Cilium as the CNI, with kube-proxy replaced | Nov 2025 |
| [009](./decisions/009-istio-ambient-mode/) | Istio in ambient mode (not sidecar mode) | Nov 2025 |
| [010](./decisions/010-cloudnative-pg/) | CloudNative PG for managed Postgres | Dec 2025 |
| [011](./decisions/011-local-llm-inference/) | Local LLM inference with Ollama on a dedicated GPU worker | Dec 2025 |
| [012](./decisions/012-layered-backup-strategy/) | A layered backup strategy | 2025–2026 |
| [013](./decisions/013-mcp-ai-operations/) | MCP servers as the AI-operations interface | Mar 2026 |
| [014](./decisions/014-vllm-inference/) | vLLM for served generation, alongside Ollama | Aug 2026 |
| [015](./decisions/015-tailscale-remote-access/) | A Tailscale subnet router for private remote access | Aug 2026 |
| [016](./decisions/016-observability-approach/) | Targeted observability tools, not a single pane of glass *(superseded by 019)* | Aug 2026 |
| [017](./decisions/017-outpost-reverse-proxy-auth/) | A reverse-proxy outpost for the apps that can't do OIDC | Sep 2026 |
| [018](./decisions/018-offsite-backup/) | An offsite copy on Backblaze B2 | Sep 2026 |
| [019](./decisions/019-metrics-and-slos/) | Prometheus goes back in, for SLOs | Oct 2026 |
| [020](./decisions/020-signed-images-runtime-enforcement/) | Signed images at admission, exec allow-lists in the kernel | Oct 2026 |
