---
title: Infrastructure
eyebrow: Platform
summary: Three repositories, three scopes — machine configs, cloud-style provisioning, and every workload delivered by GitOps.
permalink: /infrastructure/
---

The infrastructure is split across three repos, each with a distinct scope. They're hosted on my self-managed Gitea instance — the same one the cluster's CI runs on — rather than GitHub; I'm happy to walk through any of them.

---

## home-lab-talos

Talos Linux machine configurations for all cluster nodes.

- Control plane and worker node configs generated with `talosconfig`
- Node-specific patches (VIP, kubelet CA, per-node settings)
- Common patches (Cilium CNI config, installer extensions)
- Custom Talos image spec (NVIDIA extensions, bare-metal extras)
- Secrets managed separately and never committed

**Cluster layout:**

![Physical Architecture](../images/physical-architecture.png)

| Node | Role | Host | Hardware |
|---|---|---|---|
| kube-ctl-1 | Control Plane | pve-1 | HP ProDesk 600 |
| kube-ctl-2 | Control Plane | pve-2 | HP Z440 (RTX 3060 x2) |
| kube-ctl-3 | Control Plane | pve-3 | HP EliteDesk 800 |
| kube-worker-1 | Worker | pve-1 | HP ProDesk 600 |
| kube-worker-ai | Worker (GPU) | pve-2 | HP Z440 (RTX 3060 x2) |
| kube-worker-3 | Worker | pve-3 | HP EliteDesk 800 |

Storage is provided by a **Synology DS1817+** over iSCSI. The EliteDesk 800 also runs a **Proxmox Backup Server (PBS)** VM and **Home Assistant**.

---

## home-lab-terraform

Terraform managing the Proxmox layer and supporting services.

- **Proxmox:** VM definitions for all cluster nodes, PBS backup VM, Proxmox ACME certificates (Let's Encrypt via Cloudflare), host entries, APT repositories, OpenID realm (Authentik SSO)
- **Vault:** Policies, auth backends (Kubernetes, AppRole, OIDC), KV mounts
- **Authentik:** Users, groups, OAuth2 providers and applications for all SSO-integrated services
- **Gitea:** Org, users, repositories, teams
- **MinIO:** Buckets (velero-backups, postgres-backups, security-scans), IAM users, policies, service accounts
- **UptimeKuma:** HTTP monitors for all 37 endpoints, managed via `for_each` from a single locals map

---

## home-lab-argocd

All Kubernetes workloads, delivered via GitOps.

- App of Apps pattern — one root Application bootstraps everything
- Platform: Cilium for eBPF networking and policy enforcement, Istio in ambient mode for zero-trust mTLS, cert-manager for TLS automation, MetalLB for bare-metal load balancing, External Secrets Operator + Vault to keep secrets out of Git, CloudNative PG with WAL archiving to MinIO, and Velero for cluster backup and restore
- Security and compliance: Falco for runtime detection, Gitleaks and Checkov for GitOps scanning, kube-bench and Polaris for Kubernetes posture checks
- Observability: Dozzle for container logs, Netdata for node and cluster metrics, UptimeKuma for external endpoint monitoring, and Ntfy for notifications and alerts
- AI platform: Ollama serving local models from the dedicated GPU worker, Open WebUI for interactive chat, and 11 MCP servers exposing platform APIs to AI tooling ([ADR 013](../architecture/decisions/013-mcp-ai-operations/)). Earlier agent-runtime and policy-gateway experiments — Openclaw, Hermes, and Policyclaw (a custom OPA-based MCP gateway) — aren't currently running: they're shelved deliberately, their capabilities headed for a permanent home inside [Cortexa](../projects/cortexa/) rather than as standalone cluster services. The writeup is in the ADR.
- Core applications: Authentik, Gitea, Vault, MinIO, n8n and others
- User applications: Paperless, Grocy, Wallos, KaraKeep, Outline, Homepage and others
- MCP servers (11): Kubernetes, ArgoCD, Gitea, Vault, MinIO, CloudNativePG, Talos, Authentik, Synology, Unifi, and Paperless — each with scoped credentials delivered from Vault, in a namespace with no internet egress
