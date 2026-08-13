---
title: "ADR 007: Use Talos Linux as the Kubernetes OS"
eyebrow: Architecture Decision Record
summary: An immutable, API-driven, SSH-less OS — chosen to make nodes disposable and eliminate configuration drift.
permalink: /architecture/decisions/007-talos-linux/
---

**Status:** Accepted &nbsp;·&nbsp; **Date:** Nov 2025 &nbsp;·&nbsp; [← All ADRs](../../)

---

## Context

I needed an OS to run Kubernetes on bare-metal Proxmox VMs. Options considered:

- **Ubuntu/Debian** — familiar, flexible, but requires ongoing OS management (patching, drift, SSH hardening)
- **Flatcar Container Linux** — immutable, but less Kubernetes-native
- **k3OS** — lightweight but largely abandoned
- **Talos Linux** — purpose-built, immutable, API-driven, no SSH, declarative config

The cluster would be running production-like workloads (Vault, Postgres, ArgoCD, Istio) and I wanted the OS layer to be as boring and minimal as possible.

---

## Decision

Use **Talos Linux** for all Kubernetes nodes (control plane and workers).

---

## Reasoning

- **No SSH surface.** Talos has no SSH daemon, no shell, no package manager. The attack surface is tiny.
- **Declarative, versioned config.** Machine configuration lives in YAML files under version control. Nodes are treated like cattle — rebuild, don't repair.
- **First-class Kubernetes integration.** Talos ships with kubeadm-style bootstrapping but is entirely API-driven via `talosctl`.
- **Immutability eliminates drift.** There's no way to accidentally `apt install` something on a Talos node. The OS is read-only.
- **Extension support.** The NVIDIA kernel extensions and other drivers are bundled into custom Talos images, not installed at runtime.

---

## Tradeoffs

- **Debugging is different.** When something goes wrong at the node level, you work through `talosctl dmesg`, `talosctl logs`, and the API — not SSH. This takes getting used to.
- **Less ecosystem overlap.** Most tutorials assume SSH access. You have to translate.
- **Initial bootstrap is more involved.** Generating the PKI, machine configs, and secrets requires care. But once done, it's reproducible.

---

## Outcome

The cluster has been running stably. Upgrades are done by regenerating machine configs and applying them via `talosctl` — no manual steps on the nodes. I wish I would have made this decision in the beginning!

*The k0s experience that drove this decision is written up in [Lessons Learned](../../../lessons-learned/).*


<div class="adr-nav">
  <a href="../006-proxmox-vms/">&larr; ADR 006 &middot; Kubernetes on Proxmox VMs</a>
  <a class="adr-nav-all" href="../../">ADR 7 of 14</a>
  <a href="../008-cilium-cni/">ADR 008 &middot; Cilium CNI &rarr;</a>
</div>
