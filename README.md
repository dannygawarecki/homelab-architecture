# Home Lab Platform Engineering

### 📖 **[Read this as a site → dannygawarecki.github.io/homelab-architecture](https://dannygawarecki.github.io/homelab-architecture/)**

*A 6-node Talos Kubernetes cluster on Proxmox with full GitOps delivery, zero-trust networking, and local GPU inference — plus the applications running on top of it.*

<sub>Working on the site itself? See [DEVELOPMENT.md](./DEVELOPMENT.md) — preview and link-check it with Docker, no Ruby required.</sub>

---

This started in 2024 with a desire to play with Home Assistant and ESP32s and learn a little about Linux. It stayed a modest set of containers on a NAS for about eighteen months. Then, in July 2025, it got serious — and a year later I have the homelab equivalent of a mid-sized enterprise.

I didn't set out to build a platform. I set out to learn, and the learning has kept pulling me deeper. I've rebuilt my Kubernetes cluster from scratch three times. I've lost data once. I've won some hard fights with GPU passthrough, zero-trust networking and full GitOps. I lost a few small ones and one that I really wanted, GPU passthrough into k0s containers. I self-host not because there aren't better alternatives, but because you don't really understand a system until you've built it, broken it, and fixed it yourself.

This lab is by no means perfect or complete. I get about 80% of the way through each mini-project before something new and interesting pulls me sideways. There is still so much I want to do: more local LLM & AI agent work (including resurrecting the archived agent-runtime experiments), an offsite backup layer, more automation with n8n. The goalposts move every time I find something new. That's the point.

This repo is the **narrative and architecture layer**. Actual configs live in the repos below.

| Repo | Purpose |
|---|---|
| home-lab-talos | Talos Linux machine configs and cluster bootstrap |
| home-lab-terraform | Proxmox VMs, Vault, Authentik, Gitea, MinIO, UptimeKuma |
| home-lab-argocd | All Kubernetes workloads via GitOps |

*The infrastructure repos are hosted on my self-managed Gitea instance — the same one the cluster's CI runs on. Happy to walk through any of them.*

---

## The Stack

### Compute
- **3-node Proxmox cluster** (pve-1, pve-2, pve-3) with ZFS storage
- **6-node Talos Kubernetes cluster** with 3 control plane nodes, 3 workers (1 dedicated to AI)
- **GPU passthrough** on the AI worker (NVIDIA) for local LLM inference

### Networking

![Network Layout](./images/network-layout-v2.png)

- **VLAN segmentation** across management, workload, and IoT traffic
- **Cilium** as the Kubernetes CNI featuring eBPF-based networking, network policies, and egress control
- **Istio ambient mode** for zero-trust mTLS service mesh without sidecars
- **MetalLB** for bare-metal load balancing

### Platform Capabilities
This diagram covers the high-level capabilities of my homelab platform. See [`/infrastructure`](./infrastructure/) for deeper technical detail.

![Platform View](./images/platform-view-v2.png)

---

## The Journey

The foundation was already there: Unifi networking and a Synology NAS gave me a solid base to build on. From there:

- **Started with Docker containers on the NAS** — The simplest solution to running containers from my starting point
- **Moved containers to bare-metal k0s** — server treated as a pet, workloads managed as GitOps
- **Built out the initial platform layer** — SSO, secrets management, GitOps, certificate management
- **Added a dedicated AI workstation** with GPU passthrough for local LLM inference — a stack that took real work to get right
- **Graduated to Proxmox VMs** treated as disposable — the only real loss that can happen now is data, and even that is backed up
- **Migrated from k0s to Talos Linux** — declarative, immutable, no SSH, purpose-built for Kubernetes
- **Further iteration on the platform layer** — Added observability, alerting and many security capabilities

Along the way: a good amount of service selection (and reselection), many learning opportunities with basic IT services such as networking and storage, and a lot of learned intuition about when to trust AI tools and when to trust your gut.

---

## What Makes This Interesting

This isn't a homelab running a few Docker containers. It's a platform, and the engineering decisions reflect that:

- **Everything is GitOps.** No `kubectl apply` in production. Changes go through Git → ArgoCD.
- **Secrets are zero-trust.** Vault is the single source of truth. ESO syncs them into Kubernetes at runtime. Nothing is hardcoded.
- **The service mesh runs in ambient mode.** Istio without sidecars — lower overhead, same mTLS guarantees. This is still relatively new and the operational experience is genuinely different from sidecar mode.
- **Networking has teeth.** Cilium enforces egress policies per-namespace. Getting a new service to talk to the internet requires an intentional change to Git.
- **The AI worker is first-class.** GPU passthrough through Proxmox → Talos → NVIDIA device plugin → Ollama is a non-trivial stack and it works.

---

## Projects Running on the Platform

The platform exists to run things. One is a shipped product; the rest are chapters of a single arc of AI work converging on one question — *what does it take to build an AI collaborator you can actually trust?* Full write-ups are on the [site](https://dannygawarecki.github.io/homelab-architecture/projects/).

| Project | What it is | Status |
|---|---|---|
| **[big-ads](https://dannygawarecki.github.io/homelab-architecture/projects/big-ads/)** | A grocery flyer viewer built for a user with severe visual impairment. Four hostile retailer sites scraped on a schedule; a 347-line dependency-free UI. Every design decision forced by an accessibility constraint. | Shipped, in weekly use |
| **[Context Engine](https://dannygawarecki.github.io/homelab-architecture/projects/context-engine/)** | The *knowledge* piece: local-first RAG over files, sites, and git repos. Embeddings on the GPU worker, vectors in Postgres + pgvector. | First-gen, folding into Cortexa |
| **[Policyclaw](https://dannygawarecki.github.io/homelab-architecture/projects/policyclaw/)** | The *governance* piece: a Go + OPA gateway putting every mutating AI action behind a human confirmation gate. | First-gen, design input to Cortexa |
| **[Cortexa](https://dannygawarecki.github.io/homelab-architecture/projects/cortexa/)** | The synthesis: an AI collaboration engine that puts collaborative behavior in code rather than a system prompt — with a blind-judged evaluation harness built to falsify that claim. | MVP, in development |

big-ads is delivered to the cluster through the GitOps pipeline described below; the AI projects consume the platform's Postgres, Ollama, and MCP layer. Cortexa is the successor the other two are converging into — see the [through-line](https://dannygawarecki.github.io/homelab-architecture/projects/).

---

## Architecture

See [`/architecture`](./architecture/) for:
- [Network and cluster diagrams](./architecture/diagrams/)
- [Architecture Decision Records](./architecture/)

---

## Lessons Learned

See [`/lessons-learned`](./lessons-learned/) for honest write-ups on what broke, what I would do differently, and what surprised me.

---

## Copilot & AI-Assisted Engineering

See [`/copilot-experiments`](./copilot-experiments/) for notes on using GitHub Copilot to accelerate infrastructure work — including where it helped, where it hallucinated, and how I learned to drive it effectively.
