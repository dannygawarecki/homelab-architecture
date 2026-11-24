---
title: "ADR 018: An Offsite Copy on Backblaze B2"
eyebrow: Architecture Decision Record
description: The layer that doesn't live in the building — deliberately small, deliberately incomplete, and chosen by what can't be rebuilt rather than by what's valuable.
permalink: /architecture/decisions/018-offsite-backup/
card_title: "An offsite copy on Backblaze B2"
card_blurb: "Every layer but one ended on the same disk array, and a stalling LUN proved it. The copy that leaves the building is deliberately small — and chosen by what can't be rebuilt, not by what's valuable."
layout: adr
status: Accepted
date_label: Sep 2026
subsystem: Data · Backup
builds_on: ["012"]
tldr: Daily dumps, Terraform state, Vault snapshots and weekly Velero volume data go to one Backblaze B2 bucket, selected by cost of regeneration — so a restore from it is partial by design, and the 10 GB free tier constrains retention.
outcome_stats:
  - num: "6.5 GB"
    label: Steady-state offsite size
  - num: "10 GB"
    label: Free-tier ceiling
  - num: "1,166"
    label: Entries restored in drill
---

## Context

[ADR 012](../012-layered-backup-strategy/) closed with a gap named in its own tradeoffs section: every backup layer except Proxmox Backup Server terminated on the one Synology. CloudNativePG's WAL archive and the nightly logical dumps write to in-cluster MinIO, whose volume is a Synology LUN. Velero keeps metadata in MinIO and volume data in CSI snapshots on the same array as the source LUNs. Four copies, one medium.

On **2026-08-24** a stalling LUN took MinIO offline and all three of those layers failed in one event. The staleness alert that exists to catch exactly that never started, because its own mount was on the same array. The incident was a partial preview of the array dying with nothing to recover from, and it is what moved this from "the next planned layer" to built. The argument is written up in [Four Copies, One Medium](../../../writing/four-copies-one-medium/).

The alternatives considered were another NAS in the house (rejected — same building, same fire), a friend's basement (rejected — a second physical thing to maintain, and a favour that decays), and a hyperscaler's cold storage (rejected on egress pricing and on retrieval latency during the one event where it matters).

## Decision

One Backblaze B2 bucket, private, SSE-B2, with hidden versions kept 30 days, written by two independent jobs holding two separate keys:

| Prefix | Written by | What | Cadence |
|---|---|---|---|
| `minio/postgres-backups/pgdump/` | rclone CronJob | Logical dump of every database, 7 days | Daily 03:30 UTC |
| `minio/terraform-state/` | rclone CronJob | State for both Terraform repos | Daily |
| `minio/vault-backups/raft/` | rclone CronJob | Vault raft snapshots, 30 kept | Daily |
| `velero/` | Velero, schedule `offsite-weekly` | ~6 GB of volume data across 13 namespaces, 4 restore points | Sunday 05:00 UTC |

**Excluded on purpose:** the barman WAL archive and base backups (20 GB, churns daily, restores only into a matching CNPG cluster), Velero's on-site metadata bucket (points at Synology snapshots; restores nothing that isn't in git), and the Gitea container registry (2.9 GB of images CI rebuilds from Dockerfiles that are in git — moved to its own PVC so the backup could exclude it).

Velero's offsite schedule uses file-system backup (`defaultVolumesToFsBackup: true`, `snapshotVolumes: false`) rather than the CSI path, so nothing touches the NAS on the way out.

## Reasoning

- **Offsite answers one disaster, not all of them.** Point-in-time recovery answers "the database was corrupted at 14:02"; the on-site layers own that. This layer answers "the building is gone." Shipping the WAL archive offsite would pay to move one disaster's data to another disaster's destination. Losing up to a day there is the accepted outcome.
- **Select by cost of regeneration, not by value.** The container registry is valuable and free to rebuild; the 64 MB of repositories behind it are not. Every exclusion above is the same test applied.
- **The mirror's key cannot delete.** It holds list, read and write, pinned to the `minio/` prefix. rclone *hides* rather than deletes on B2 and hiding needs only write, so `rclone sync` still mirrors removals while a stolen key cannot destroy history. Only the bucket lifecycle rule ever truly deletes. Velero's key does hold delete — kopia maintenance requires it — and is pinned to `velero/`.
- **Two writers, two keys, two prefixes.** A compromise or a bug in either path cannot reach the other's data.
- **Retention is not mirrored from on-site.** B2 bills every version including hidden ones, so a naive mirror of the 14-day on-site dump window settles at 44 days and 8.6 GB. Offsite keeps 7 days with a 7-day hidden-version rule — 2.7 GB. The two layers answer different questions and have no reason to hold the same thing.

## Tradeoffs

- **A restore is partial by design.** After recovering from this bucket the container registry is empty until each image's next CI build, and Postgres is as current as the last nightly dump rather than the last transaction. Both are accepted, and both are only correct because the on-site layers still exist.
- **It depends on a vendor and an account.** Self-hosting this copy would put it back inside the blast radius it exists to be outside of, so the dependency is the point — but it is real, and the account credentials are now a recovery artifact in their own right, stored with the Vault recovery keys.
- **The free tier is a design constraint, not a budget.** Staying under 10 GB is why retention is short and exclusions are aggressive. A size guard fails the sync job above 5 GiB and pages; it runs *after* the mirror, so an overrun costs a notification and never a skipped backup.
- **Defaults tuned for a busy endpoint are wrong here.** Velero validates a location every minute by default — ~2,900 Class C calls a day against a location receiving one backup a week, which nearly tripped a daily account cap on build day. Now hourly, at the cost of up to an hour's delay in noticing a broken credential.

## Outcome

Built over 2026-09-12/13; steady state about 6.5 GB against the 10 GB free tier, reached roughly two months out as backups containing the registry expire.

**Drilled on 2026-09-20**, deliberately rather than under duress: a Gitea dump pulled from B2 to a workstation, SHA-1 verified against what Backblaze recorded at upload, restored into a throwaway `postgres:18` container in local Docker with no cluster component in the data path, across a minor version (18.4 → 18.6). `pg_restore` exit 0, 1,166 entries, 4 seconds; tables, repositories and users identical to live, and the write-heavy tables correctly *behind* live by the eighteen hours since the dump ran.

The drill's most useful result was a mistake it caught. The Backblaze read key came from a Kubernetes secret in the cluster, because the local Vault token had expired and that path was open — which means a rehearsal of recovering without the platform reached into the platform for its first step. In the real event the key comes from the Backblaze console under account credentials held outside everything described here. The procedure now says so explicitly.

Undrilled, and named rather than implied: a Vault raft snapshot restore into a new Vault, a Velero restore from this location, and a full-size database. The drill log in `docs/OFFSITE-BACKUP.md` is where that list shortens.
