---
title: Architecture
eyebrow: Platform
summary: The diagrams that describe the platform, and the decision records that explain why it looks the way it does.
permalink: /architecture/
---

## [Diagrams](./diagrams/)

Physical architecture, network layout, and platform capability map — with descriptions of what each diagram shows.

---

## [Architecture Decision Records](./decisions/)

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
