---
title: "ADR 007: Use Talos Linux as the Kubernetes OS"
eyebrow: Architecture Decision Record
description: An immutable, API-driven, SSH-less OS — chosen to make nodes disposable and eliminate configuration drift.
permalink: /architecture/decisions/007-talos-linux/
card_title: "Talos Linux as the Kubernetes OS"
card_blurb: "An immutable, API-driven OS with no SSH and no package manager — so nodes become genuinely disposable."
layout: adr
status: Accepted
date_label: Nov 2025
subsystem: Compute · OS
tldr: Talos Linux runs every Kubernetes node, control plane and workers — no SSH, a read-only OS, declarative config under version control — at the cost of debugging through talosctl and the API instead of a shell, and a more involved bootstrap.
---

## Context

I needed an OS to run Kubernetes on bare-metal Proxmox VMs. Options considered:

- <span class="opt">Rejected</span> **Ubuntu/Debian** — familiar, flexible, but requires ongoing OS management (patching, drift, SSH hardening)
- <span class="opt">Rejected</span> **Flatcar Container Linux** — immutable, but less Kubernetes-native
- <span class="opt">Rejected</span> **k3OS** — lightweight but largely abandoned
- <span class="opt opt-chosen">Chosen</span> **Talos Linux** — purpose-built, immutable, API-driven, no SSH, declarative config

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

> **Update (Oct 2026):** Three things changed around the decision, none of them the decision. **talhelper**, the tool that generated the machine configs, was archived upstream, so configs moved to **topf** — proven with a zero-drift dry run on all six nodes before anything was applied. Talos 1.14 brought **workload isolation**: containerd, the kubelet, and every pod now run in their own PID and mount namespace, apart from the Talos system services, on all six nodes. Measured on the busiest worker, kube-bench came out identical and storage and GPU paths still worked; the one cost was Netdata losing its view of host processes. And **drift became an alarm**: an hourly job compares the Talos and Kubernetes versions in Git with what the nodes report and pages when they disagree, while Renovate queues Talos updates for a human rather than merging them. The cluster runs Talos v1.14.1 and Kubernetes 1.36.

*The k0s experience that drove this decision is written up in [Lessons Learned](../../../lessons-learned/).*
