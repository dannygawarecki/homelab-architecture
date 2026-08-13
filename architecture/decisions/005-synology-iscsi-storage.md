---
title: "ADR 005: Synology iSCSI via CSI as Primary Storage"
eyebrow: Architecture Decision Record
summary: Centralized NAS storage over a dedicated network, chosen over distributed storage I would have operated badly — with the single point of failure named and accepted.
permalink: /architecture/decisions/005-synology-iscsi-storage/
---

**Status:** Accepted &nbsp;·&nbsp; **Date:** Oct 2025 &nbsp;·&nbsp; [← All ADRs](../../)

---

## Context

Persistent storage is the most consequential choice in any cluster — it's the one layer where a bad decision costs data, and this platform has [lost data once](../../../lessons-learned/). The options:

- **Local-path provisioning** — what the cluster actually used at first (the configs are still in the GitOps repo's archive). Fast and simple, but a volume is welded to a node, which makes "nodes are disposable" a lie.
- **Longhorn** — Kubernetes-native replicated storage. Attractive, but replication across three consumer mini-PCs over the general network adds failure modes I'd be debugging instead of using.
- **Rook-Ceph** — the serious answer at scale, and vast operational overkill for this hardware.
- **NFS from the NAS** — simple, but weaker semantics for databases than block storage.
- **iSCSI from the Synology via its CSI driver** — block volumes from hardware I already own, trust, and monitor, with RAID and snapshots built in.

## Decision

The **Synology CSI driver** provides one StorageClass — iSCSI-backed, `ext4`, with **`reclaimPolicy: Retain`** and volume expansion enabled — over a **dedicated storage VLAN**. It is the default and near-universal class: Vault, Gitea, the Postgres cluster, CI caches, and application PVCs all live on it. Snapshot classes are wired in, which lets Velero take CSI snapshots ([ADR 012](../012-layered-backup-strategy/)).

## Reasoning

- **Operate what you already trust.** The DS1817+ predates the cluster and does RAID, snapshots, and health monitoring as an appliance. Distributed storage would replace hardware I trust with software I'd be learning during outages.
- **Block, not file, for databases.** iSCSI gives Postgres proper block semantics.
- **`Retain` is a data-loss lesson written into config.** Deleting a PVC — or a namespace, or the whole cluster — leaves the underlying LUN intact. Reclaiming space is deliberately a manual act on the NAS.
- **A dedicated storage VLAN** isolates iSCSI traffic from workload noise — a segmentation decision that earned its keep during the MTU debugging saga in [Lessons Learned](../../../lessons-learned/).

## Tradeoffs

- **The NAS is a single point of failure for every persistent volume.** Named, accepted, and mitigated by the backup layers in [ADR 012](../012-layered-backup-strategy/) rather than by storage-level HA. At this scale, I'd rather have one excellent storage box plus real backups than three mediocre replicas.
- **Storage performance is bounded by the network path** to the NAS, not by local NVMe.
- **The CSI driver is a smaller project** than Longhorn or Rook, with a correspondingly smaller community when something is odd.

## Outcome

Every stateful workload on the platform runs on the same storage class with the same guarantees. Volume expansion has been used in anger. Node rebuilds — the whole point of the disposability story — don't move data, because data was never on the nodes.


<div class="adr-nav">
  <a href="../004-authentik-sso/">&larr; ADR 004 &middot; Authentik SSO</a>
  <a class="adr-nav-all" href="../../">ADR 5 of 14</a>
  <a href="../006-proxmox-vms/">ADR 006 &middot; Kubernetes on Proxmox VMs &rarr;</a>
</div>
