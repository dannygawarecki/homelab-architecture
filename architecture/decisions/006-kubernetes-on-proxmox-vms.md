---
title: "ADR 006: Kubernetes Nodes as Proxmox VMs, Not Bare Metal"
eyebrow: Architecture Decision Record
summary: The virtualization pivot that made nodes disposable, backups whole, and GPU passthrough finally work.
permalink: /architecture/decisions/006-proxmox-vms/
---

**Status:** Accepted &nbsp;·&nbsp; **Date:** Nov 2025 &nbsp;·&nbsp; [← All ADRs](../../)

---

## Context

The early cluster ran k0s directly on bare metal, with the server treated as a pet. That period produced two hard lessons: OS-level problems meant logging in and hand-fixing state I could no longer reconstruct, and GPU passthrough into containers on bare-metal k0s was a fight I lost completely.

Options for the next iteration:

- **Stay bare metal** — maximum performance, no virtualization layer to learn. But every node remains a pet, and rebuilding means reinstalling an OS on hardware.
- **Proxmox VE with Kubernetes nodes as VMs** — a hypervisor layer on each of the three hosts, nodes become disk images.
- **Other hypervisors** — ESXi's free tier was effectively dead; XCP-ng was viable but with a smaller homelab ecosystem and no ZFS-native story.

## Decision

Run a **3-node Proxmox cluster** (ZFS on each host) and provision **every Kubernetes node as a VM**, defined in Terraform. Placement is deliberate and static: each control-plane VM lands on a different physical host, so no single hardware failure takes out quorum.

## Reasoning

- **Nodes become genuinely disposable.** A broken node is destroyed and recreated from Terraform + Talos configs in minutes. "Rebuild, don't repair" only works when rebuild is cheap.
- **Whole-VM backups.** Proxmox Backup Server snapshots entire node images — a recovery layer that exists *below* Kubernetes and doesn't care what state the cluster is in.
- **GPU passthrough worked.** PCIe passthrough of both RTX 3060s into the AI worker VM succeeded on the first serious attempt — the same goal that was unwinnable on bare-metal k0s. The dedicated AI worker gets 16 cores and the lion's share of its host's RAM.
- **Right-sized nodes.** Control-plane nodes are small (4 cores); workers are sized to their role. Bare metal would waste an entire host on a control-plane node that needs a fraction of it.

## Tradeoffs

- **A virtualization tax.** CPU and I/O overhead, plus VLAN-aware bridging between the physical network and VM NICs — one more layer where networking can go subtly wrong.
- **Another platform to operate.** Three Proxmox hosts need patching, certificates, and monitoring of their own. (Terraform manages their ACME certs, repos, and SSO integration to keep this declarative too.)
- **IOMMU complexity.** Passthrough requires correct IOMMU grouping at the host layer — see the GPU chain writeup in [Lessons Learned](../../../lessons-learned/).
- **Placement is manual.** Terraform pins each VM to a host; there is no scheduler ensuring anti-affinity beyond my own discipline.

## Outcome

Nodes are rebuilt routinely without drama. The full stack — Proxmox → Talos VM → NVIDIA device plugin → Ollama — has survived host reboots and upgrades. This decision is the foundation [ADR 007 (Talos)](../007-talos-linux/) stands on: immutable node OS only pays off when creating and destroying nodes is trivial.


<div class="adr-nav">
  <a href="../005-synology-iscsi-storage/">&larr; ADR 005 &middot; Synology iSCSI storage</a>
  <a class="adr-nav-all" href="../../">ADR 6 of 14</a>
  <a href="../007-talos-linux/">ADR 007 &middot; Talos Linux &rarr;</a>
</div>
