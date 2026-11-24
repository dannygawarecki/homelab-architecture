---
title: "ADR 012: A Layered Backup Strategy"
eyebrow: Architecture Decision Record
description: Five recovery layers with different failure domains — the decision record for "what changed after losing data," and for what August 2026 proved about how independent they actually were.
permalink: /architecture/decisions/012-layered-backup-strategy/
card_title: "A layered backup strategy"
card_blurb: "Five recovery layers with different failure domains — what changed after losing data once, and what August 2026 proved about how independent they really were."
layout: adr
status: Accepted
date_label: Built up over 2025–2026
subsystem: Data · Backup
tldr: Backups are five layers that fail differently, plus monitoring of the backups themselves — though three on-site layers share MinIO on the NAS, which failed together in August 2026, and no full end-to-end restore drill has happened.
outcome_stats:
  - num: "5"
    label: Recovery layers
  - num: "26h"
    label: Staleness alert threshold
  - num: "1 of 5"
    label: Paths drilled deliberately
---

## Context

This platform has [lost data once](../../../lessons-learned/). The redesign principle that followed: no single backup mechanism, because any one mechanism shares a failure domain with something — the cluster, the storage, the tool itself. Instead, layers that fail differently.

## Decision

Five layers, plus monitoring of the backups themselves:

| Layer | Tool | What it protects | Cadence |
|---|---|---|---|
| **VM images** | Proxmox Backup Server | Entire node/VM state, below Kubernetes | Scheduled at the Proxmox layer |
| **Cluster state** | Velero → MinIO, CSI snapshots via Synology | All namespaces' Kubernetes objects + volume snapshots | Daily, 7-day retention |
| **Database PITR** | CloudNativePG WAL archiving (Barman) → MinIO | Continuous Postgres WAL + base backups, point-in-time recovery | Continuous; 14-day retention |
| **Logical dumps** | Nightly `pg_dump` CronJob → MinIO | Portable dumps of every database | Nightly, 14-day prune |
| **Offsite** | rclone + Velero file-system backup → Backblaze B2 ([ADR 018](../018-offsite-backup/)) | The subset that has to survive the building | Daily mirror; weekly volume data |

The monitoring layer: a CronJob runs 30 minutes after the Velero window, queries the Kubernetes API for the latest backup, and pushes an alert to ntfy if it's missing, failed, or older than 26 hours. **A backup that isn't checked is a hope, not a backup.**

## Reasoning

- **Different layers answer different disasters.** PBS restores a dead node without Kubernetes existing. Velero restores cluster objects and volumes into a fresh cluster. WAL archiving answers "the database was corrupted at 14:02" with a point-in-time restore. `pg_dump` files restore into *any* Postgres anywhere — the escape hatch if every platform-specific tool fails.
- **The logical-dump layer is deliberate redundancy.** WAL archives are only readable by the same tooling that wrote them; a plain dump has no such dependency. Two Postgres paths is a feature, not an accident.
- **Alerting on absence.** Most backup failures are silent — the job stops running and nobody notices until restore day. The 26-hour staleness alert exists precisely because of that failure mode.

## Tradeoffs

- **MinIO is a shared dependency for three of the on-site layers.** Velero, WAL archives, and dumps all land in in-cluster MinIO on Synology-backed storage — which concentrates risk in the NAS ([ADR 005](../005-synology-iscsi-storage/) accepts it as SPOF; PBS and the offsite layer are the two that don't share it).

  **This tradeoff stopped being theoretical on 2026-08-24.** A stalling LUN took MinIO offline and all three of those layers failed together, which is precisely what this paragraph said would happen. The backup-staleness alert never started: its own mount was on the same array. A monitor inside the failure domain it monitors reports nothing when that domain is what fails. Both are the subject of [Four Copies, One Medium](../../../writing/four-copies-one-medium/).
- **The offsite layer is deliberately partial.** It holds what cannot be rebuilt, not everything: the WAL archive, Velero's metadata bucket and the container registry are excluded on purpose. Up to a day of WAL loss in a building-level disaster is an accepted outcome. See [ADR 018](../018-offsite-backup/) for what is excluded and why.

## Outcome

Honest status on drills: most layers have been exercised only in pieces, and mostly under duress. I've restored a LUN snapshot to get a volume back, restored Postgres from backup, and partially restored Velero manifest backups — each in response to a real problem, never as a single coordinated end-to-end rehearsal. The rebuild-from-scratch events that shaped this platform ([Lessons Learned](../../../lessons-learned/)) recovered from Git + backups rather than from memory, and the daily alert has caught real backup failures before they became discoveries.

**One path is now drilled deliberately rather than under duress.** On 2026-09-20 a Gitea dump was pulled from Backblaze to a workstation, checksum-verified against what B2 recorded at upload, and restored into a throwaway `postgres:18` container in local Docker — nothing from the cluster in the data path, and across a minor version (18.4 → 18.6), which is the portability claim above being tested rather than asserted. `pg_restore` returned 0; table, repository and user counts matched live. The drill log lives in `docs/OFFSITE-BACKUP.md` in the platform repo.

It also found something no green result would have: the Backblaze read key came from the cluster, because the local Vault token had expired and the key is synced into a Kubernetes secret. In the disaster this layer exists for, that shortcut is not available — the key comes from the Backblaze console, using account credentials stored with the Vault recovery keys. The runbook now says so.

The gap I'll still name plainly: a full, coordinated restore drill — fresh cluster, every layer, in order — has not happened. A Vault raft snapshot restore, a Velero restore from the Backblaze location, and a full-size database are all undrilled. That's the honest difference between "I have backups" and "I have a tested recovery," and one of five paths does not close it.
