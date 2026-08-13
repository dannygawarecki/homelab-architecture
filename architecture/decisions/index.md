---
title: Architecture Decision Records
eyebrow: Architecture
summary: The major platform choices, the alternatives actually considered, and the tradeoffs accepted rather than solved.
permalink: /architecture/decisions/
---

Each record follows the same shape: **Context** (what problem, what options), **Decision**, **Reasoning**, **Tradeoffs**, and **Outcome** — written after the decision had been lived with long enough to know whether it held up.

The Tradeoffs section is the one that matters. Any choice can be justified; the useful question is what it cost.

The records are ordered as the platform came together — foundational choices first — and every one links to the next at its foot, so you can read straight through.

<div class="cards" markdown="0">
  <a class="card" href="001-gitops-argocd/">
    <span class="card-tag">ADR 001 · Jul 2025</span>
    <h3>GitOps with ArgoCD — App of Apps</h3>
    <p>One root Application bootstraps the entire cluster. Git is the only supported way to change anything — the paradigm everything else lives under.</p>
  </a>
  <a class="card" href="002-self-hosted-gitea-ci/">
    <span class="card-tag">ADR 002 · Jul 2025</span>
    <h3>Self-hosted Gitea with in-cluster CI</h3>
    <p>Git, CI runners, and the container registry all live inside the cluster they deploy — the self-hosted substrate the GitOps loop runs on.</p>
  </a>
  <a class="card" href="003-vault-external-secrets/">
    <span class="card-tag">ADR 003 · Aug 2025</span>
    <h3>Vault + ESO as the only secrets path</h3>
    <p>One source of truth, synced at runtime, with manual Shamir unsealing accepted as the cost of owning the root of trust.</p>
  </a>
  <a class="card" href="004-authentik-sso/">
    <span class="card-tag">ADR 004 · Aug 2025</span>
    <h3>Authentik as the identity provider</h3>
    <p>One login for everything — including Vault, ArgoCD, and Proxmox — declared entirely in Terraform.</p>
  </a>
  <a class="card" href="005-synology-iscsi-storage/">
    <span class="card-tag">ADR 005 · Oct 2025</span>
    <h3>Synology iSCSI as primary storage</h3>
    <p>Centralized NAS block storage over distributed storage I'd operate badly — the single point of failure named and accepted.</p>
  </a>
  <a class="card" href="006-proxmox-vms/">
    <span class="card-tag">ADR 006 · Nov 2025</span>
    <h3>Kubernetes nodes as Proxmox VMs</h3>
    <p>The virtualization pivot that made nodes disposable, backups whole, and GPU passthrough finally work.</p>
  </a>
  <a class="card" href="007-talos-linux/">
    <span class="card-tag">ADR 007 · Nov 2025</span>
    <h3>Talos Linux as the Kubernetes OS</h3>
    <p>An immutable, API-driven OS with no SSH and no package manager — so nodes become genuinely disposable.</p>
  </a>
  <a class="card" href="008-cilium-cni/">
    <span class="card-tag">ADR 008 · Nov 2025</span>
    <h3>Cilium as the CNI</h3>
    <p>eBPF networking, no kube-proxy at all, and an egress-lanes model where internet access is an explicit Git change.</p>
  </a>
  <a class="card" href="009-istio-ambient-mode/">
    <span class="card-tag">ADR 009 · Nov 2025</span>
    <h3>Istio in ambient mode, not sidecars</h3>
    <p>Cluster-wide mTLS without per-pod proxies. Lower overhead and a one-label rollout, against a younger ecosystem.</p>
  </a>
  <a class="card" href="010-cloudnative-pg/">
    <span class="card-tag">ADR 010 · Dec 2025</span>
    <h3>CloudNative PG for managed Postgres</h3>
    <p>Operator-managed Postgres with WAL archiving to MinIO, replacing one database container per application.</p>
  </a>
  <a class="card" href="011-local-llm-inference/">
    <span class="card-tag">ADR 011 · Dec 2025</span>
    <h3>Local LLM inference on a dedicated GPU worker</h3>
    <p>GPU passthrough from Proxmox through Talos into Kubernetes, so no prompt ever leaves the network.</p>
  </a>
  <a class="card" href="012-layered-backup-strategy/">
    <span class="card-tag">ADR 012 · 2025–2026</span>
    <h3>A layered backup strategy</h3>
    <p>Four independent recovery layers with different failure domains — what changed after losing data once.</p>
  </a>
  <a class="card" href="013-mcp-ai-operations/">
    <span class="card-tag">ADR 013 · Mar 2026</span>
    <h3>MCP servers as the AI-ops interface</h3>
    <p>Eleven scoped, in-cluster MCP servers give AI tooling live platform access without credentials ever leaving the cluster.</p>
  </a>
  <a class="card" href="014-vllm-inference/">
    <span class="card-tag">ADR 014 · Aug 2026</span>
    <h3>vLLM for served generation</h3>
    <p>A throughput-first runtime — a quantized 30B tensor-parallel across both GPUs — alongside Ollama, which moved to embeddings. Documented mid-migration.</p>
  </a>
</div>
