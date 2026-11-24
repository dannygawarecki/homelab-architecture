---
title: "ADR 002: Self-Hosted Gitea with In-Cluster CI"
eyebrow: Architecture Decision Record
description: The Git server, CI runners, and container registry all live inside the cluster they deploy — sovereignty traded against a bootstrap circularity I chose to own.
permalink: /architecture/decisions/002-self-hosted-gitea-ci/
card_title: "Self-hosted Gitea with in-cluster CI"
card_blurb: "Git, CI runners, and the container registry all live inside the cluster they deploy — the self-hosted substrate the GitOps loop runs on."
layout: adr
status: Accepted
date_label: Jul 2025
subsystem: Delivery · CI
tldr: Gitea, its built-in registry, and Gitea Actions runners all run inside the cluster they deploy, keeping the whole delivery loop in-platform — at the price of an accepted bootstrap circularity and privileged Docker-in-Docker CI.
outcome_stats:
  - num: "9"
    label: CI-driven big-ads releases
  - num: "2"
    label: Parallel CI jobs
---

## Context

GitOps needs a Git host, CI needs runners, and images need a registry. The real shortlist was two — GitHub, or self-host with Gitea — with a glance at the heavier open-source options:

- <span class="opt">Rejected</span> **GitHub (SaaS)** — zero operations, excellent tooling. But the platform's control plane would live outside the platform, and self-hosting *was* the point of this lab.
- <span class="opt">Rejected</span> **Self-hosted GitLab** — batteries included, and famously heavy; it would have been the largest single workload on the cluster.
- <span class="opt opt-chosen">Chosen</span> **Gitea** — lightweight, includes an OCI-compliant container registry, and its Actions are GitHub-Actions-compatible, so workflow knowledge transfers in both directions. It was easily the winner.

## Decision

**Gitea runs in the cluster**, backed by the platform's own CloudNativePG cluster ([ADR 010](../010-cloudnative-pg/)) and Synology-backed storage. Its **built-in registry** is the private registry for every custom image. CI is **Gitea Actions** with an `act_runner` StatefulSet using a Docker-in-Docker sidecar, capacity two parallel jobs. Terraform manages the org, repos, and teams; Renovate keeps dependencies moving.

## Reasoning

- **The entire delivery loop is inside the platform.** Push → Actions build → registry push → GitOps manifest patch → ArgoCD reconcile, with the runner cloning over in-cluster DNS. No external service is in the critical path of a deploy — [big-ads](../../../projects/big-ads/) exercises this end-to-end weekly.
- **The registry comes free.** No separate Harbor/Distribution deployment to operate.
- **GitHub-compatible workflow syntax** means CI definitions are portable and AI tooling understands them.
- **Dogfooding with real stakes.** Gitea consuming the platform's Postgres, secrets, SSO, and storage means the platform's core services have a demanding, always-on customer.

## Tradeoffs

- **The bootstrap circularity is real and accepted.** The cluster hosts the Git repos that define the cluster. My recovery position: Git is distributed — every working clone is a complete copy of the config — plus whole-VM backups below Kubernetes and Velero above it. Rebuilding means bootstrapping from a local clone, then re-pointing ArgoCD at the restored Gitea.
- **Privileged CI is a genuine security concession.** Docker-in-Docker runs privileged; the runner is the least-confined workload on the platform. It's contained by network policy and its own namespace, but I don't pretend `privileged: true` is anything other than a tradeoff.
- **I own the upgrades** for the service everything else depends on for delivery.

## Outcome

Nine CI-driven releases of big-ads shipped through this pipeline with no manual steps. Custom MCP server images build and publish here. The circular-dependency question — "what if the cluster hosting your Git dies?" — has a rehearsed answer, which is more than most setups with the same architecture can say.
