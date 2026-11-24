---
title: "ADR 010: CloudNative PG for Managed Postgres"
eyebrow: Architecture Decision Record
summary: An operator-managed Postgres with WAL archiving to MinIO, instead of one database container per application.
permalink: /architecture/decisions/010-cloudnative-pg/
card_title: "CloudNative PG for managed Postgres"
card_blurb: "Operator-managed Postgres with WAL archiving to MinIO, replacing one database container per application."
layout: adr
status: Accepted
date_label: Dec 2025
subsystem: Data · Postgres
tldr: Every Postgres workload runs in a single shared CloudNative PG cluster with per-app databases and WAL archiving to MinIO, buying one consistent backup story at the cost of a shared blast radius.
---

## Context

Several applications in the cluster require Postgres: Authentik, Gitea, Paperless-NGX, Outline, and others. Options for providing it:

- <span class="opt">Rejected</span> **Bundled per-app Postgres** — each Helm chart deploys its own `StatefulSet`. Simple, but no consistency in backup strategy, upgrade path, or configuration. One misconfiguration per app, repeated across every app.
- <span class="opt">Rejected</span> **Single self-managed StatefulSet** — one shared Postgres instance. Backup and restore is a manual concern. No operator, no WAL archiving, no automatic failover.
- <span class="opt">Rejected</span> **Zalando Postgres Operator** — mature, widely used, but more complex configuration model.
- <span class="opt opt-chosen">Chosen</span> **CloudNative PG (CNPG)** — CNCF-graduated operator. First-class Kubernetes resource model, built-in WAL archiving, backup/restore via object storage, declarative cluster definitions.

The core requirement was consistency: every database should be backed up the same way, recoverable to a known point in time, and managed with the same tooling.

---

## Decision

Use **CloudNative PG** as the single operator for all Postgres workloads in the cluster. Applications that ship their own Postgres are configured to use CNPG-managed clusters instead.

Rather than provisioning a dedicated `Cluster` resource per application, run a **single shared CNPG cluster** with separate databases and roles per application. Each application connects with its own credentials scoped to its own database.

---

## Reasoning

- **Resource efficiency.** A dedicated CNPG cluster per application (each with its own primary and replica pods) would consume far more CPU and memory than the workloads justify. A single shared cluster with per-app databases carries a fraction of the overhead.
- **WAL archiving to MinIO.** Continuous WAL shipping to the in-cluster MinIO instance gives point-in-time recovery (PITR) for every database. This is not something you get for free from a bundled StatefulSet.
- **Consistent backup story.** All databases are backed up the same way. Velero handles the Kubernetes state layer; CNPG + MinIO handles the data layer. There's no per-app special case.
- **Declarative cluster definitions.** A `Cluster` resource specifies replicas, storage class, backup schedule, and WAL target — all in Git, all managed via ArgoCD.
- **CNCF graduation.** CNPG is production-grade and actively maintained. The operator model is clean and Kubernetes-native.
- **Operational leverage.** Managing ten isolated StatefulSets across ten namespaces would mean ten different failure modes, ten backup scripts, and ten sets of upgrade notes. One operator manages all of them the same way.

---

## Tradeoffs

- **Shared blast radius.** A cluster-level failure (storage issue, runaway migration, operator bug) affects all databases. Per-app clusters would contain the blast radius at the cost of much higher resource overhead — an acceptable tradeoff at homelab scale.
- **Bootstrap ordering.** CNPG must be installed before any application that depends on it. ArgoCD sync waves handle this, but it's an explicit dependency to manage.
- **Not all apps support external Postgres cleanly.** Some Helm charts assume a bundled database and require non-trivial override values to point at an external cluster.
- **MinIO is a dependency.** WAL archiving depends on MinIO being healthy. If MinIO has a problem, WAL archiving pauses — recoverable, but worth monitoring.

---

## Outcome

All stateful applications in the cluster use CNPG-managed Postgres clusters. WAL is continuously archived to MinIO. Scheduled base backups run nightly. Each database is independently restorable to any point in time without affecting others.
