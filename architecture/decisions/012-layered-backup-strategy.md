---
title: "ADR 012: A Layered Backup Strategy"
eyebrow: Architecture Decision Record
summary: Four independent recovery layers with different failure domains — the decision record for "what changed after losing data."
permalink: /architecture/decisions/012-layered-backup-strategy/
---

**Status:** Accepted &nbsp;·&nbsp; **Date:** Built up over 2025–2026 &nbsp;·&nbsp; [← All ADRs](../../)

---

## Context

This platform has [lost data once](../../../lessons-learned/). The redesign principle that followed: no single backup mechanism, because any one mechanism shares a failure domain with something — the cluster, the storage, the tool itself. Instead, layers that fail differently.

## Decision

Four independent layers, plus monitoring of the backups themselves:

| Layer | Tool | What it protects | Cadence |
|---|---|---|---|
| **VM images** | Proxmox Backup Server | Entire node/VM state, below Kubernetes | Scheduled at the Proxmox layer |
| **Cluster state** | Velero → MinIO, CSI snapshots via Synology | All namespaces' Kubernetes objects + volume snapshots | Daily, 7-day retention |
| **Database PITR** | CloudNativePG WAL archiving (Barman) → MinIO | Continuous Postgres WAL + base backups, point-in-time recovery | Continuous; 14-day retention |
| **Logical dumps** | Nightly `pg_dump` CronJob → MinIO | Per-database portable dumps of the five critical apps | Nightly, 14-day prune |

The monitoring layer: a CronJob runs 30 minutes after the Velero window, queries the Kubernetes API for the latest backup, and pushes an alert to ntfy if it's missing, failed, or older than 26 hours. **A backup that isn't checked is a hope, not a backup.**

## Reasoning

- **Different layers answer different disasters.** PBS restores a dead node without Kubernetes existing. Velero restores cluster objects and volumes into a fresh cluster. WAL archiving answers "the database was corrupted at 14:02" with a point-in-time restore. `pg_dump` files restore into *any* Postgres anywhere — the escape hatch if every platform-specific tool fails.
- **The logical-dump layer is deliberate redundancy.** WAL archives are only readable by the same tooling that wrote them; a plain dump has no such dependency. Two Postgres paths is a feature, not an accident.
- **Alerting on absence.** Most backup failures are silent — the job stops running and nobody notices until restore day. The 26-hour staleness alert exists precisely because of that failure mode.

## Tradeoffs

- **MinIO is a shared dependency for three of four layers.** Velero, WAL archives, and dumps all land in in-cluster MinIO on Synology-backed storage — which concentrates risk in the NAS ([ADR 005](../005-synology-iscsi-storage/) accepts it as SPOF; PBS is the layer that doesn't share it).
- **No offsite layer yet.** Everything above lives in the same building. A fire is unhandled. This is the known, honest gap in the design and the next planned layer.

## Outcome

Honest status on drills: I've exercised every layer, but only in pieces, and mostly under duress. I've restored a LUN snapshot to get a volume back, restored Postgres from backup, and partially restored Velero manifest backups — each in response to a real problem, never as a single coordinated end-to-end rehearsal. The rebuild-from-scratch events that shaped this platform ([Lessons Learned](../../../lessons-learned/)) recovered from Git + backups rather than from memory, and the daily alert has caught real backup failures before they became discoveries.

The gap I'll name plainly: a full, coordinated restore drill — fresh cluster, every layer, in order — is planned and hasn't happened. The pieces have all worked; the whole has never been rehearsed in one sitting. That's the honest difference between "I have backups" and "I have a tested recovery."


<div class="adr-nav">
  <a href="../011-local-llm-inference/">&larr; ADR 011 &middot; Local LLM inference</a>
  <a class="adr-nav-all" href="../../">ADR 12 of 14</a>
  <a href="../013-mcp-ai-operations/">ADR 013 &middot; MCP for AI operations &rarr;</a>
</div>
