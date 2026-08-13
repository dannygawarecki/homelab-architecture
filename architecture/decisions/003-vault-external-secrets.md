---
title: "ADR 003: Vault + External Secrets Operator as the Only Secrets Path"
eyebrow: Architecture Decision Record
summary: One source of truth for every secret, synced into Kubernetes at runtime — chosen after living with the alternative.
permalink: /architecture/decisions/003-vault-external-secrets/
---

**Status:** Accepted &nbsp;·&nbsp; **Date:** Aug 2025 &nbsp;·&nbsp; [← All ADRs](../../)

---

## Context

Early on, secrets lived wherever was convenient: manually created Kubernetes Secrets, ArgoCD's credential store, values files. Retrofitting out of that state was painful enough to earn its own entry in [Lessons Learned](../../../lessons-learned/).

I'll be straight about the process: I didn't run a bake-off. I use Vault at work, wanted to understand it more deeply, and knew it would do the job — so I went with it. That's a legitimate way to pick a tool, and pretending otherwise would be dishonest. For the record, the alternatives I'd have been choosing against:

- **SOPS-encrypted secrets in Git** — simple, GitOps-native, but every rotation is a commit, and the encryption key becomes the crown jewel with no audit trail around it.
- **Sealed Secrets** — similar shape; cluster-coupled encryption, awkward key rotation and disaster recovery.
- **Cloud secret managers** — outsources the hard part, but puts the homelab's keys outside the homelab.
- **HashiCorp Vault + External Secrets Operator** — a real secrets engine with auth backends, policies, and audit, synced into the cluster at runtime.

Vault won on merits I already trusted rather than on a comparison I ran — and the deep-end learning was part of the point.

## Decision

**Vault is the single source of truth.** One KV v2 mount holds everything. A single **ClusterSecretStore** connects External Secrets Operator to Vault using **Kubernetes auth** — ESO's service account authenticates with its projected token, so there is no static Vault credential anywhere in the cluster. Roughly **47 ExternalSecret resources** across ~25 namespaces sync on a 1-hour refresh.

Access paths are per-consumer: humans authenticate to Vault via **OIDC through Authentik** ([ADR 004](../004-authentik-sso/)); Terraform reads secrets at plan time (using ephemeral values so they never persist in state where the provider allows it); one legacy AppRole exists for a single edge service.

## Reasoning

- **Nothing secret in Git, ever** — which is what makes it safe for Gitleaks to scan the GitOps repos nightly and for this architecture to be written about publicly.
- **Rotation is an edit, not a redeploy.** Change the value in Vault; ESO converges consumers within the refresh window.
- **Scoped machine identity.** ESO's Vault policy is read-only on the KV data path. The Kubernetes auth role binds to exactly one service account in one namespace.
- **One audit point** for every secret read on the platform.

## Tradeoffs

- **Vault is the most operationally demanding thing I run.** It is deliberately configured with **Shamir 3-of-5 manual unsealing and no auto-unseal** — every Vault restart requires me to show up with key shares. Until unsealed, ESO syncs stall and dependent apps look degraded. I accepted this: auto-unseal either moves root-of-trust to a cloud KMS or reduces to secrets-protecting-secrets on the same hardware.
- **Bootstrap circularity.** Vault stores credentials that Terraform needs, and Terraform manages Vault's own configuration. The ordering is documented, but recovery-from-nothing requires care.
- **Cross-layer coupling.** ESO's Kubernetes auth depends on the cluster's CA and API endpoint being registered in Vault — which means a cluster CA rotation reaches into Vault configuration. This bit me in practice and the runbook now reflects it.

## Outcome

Every secret a workload consumes arrives through the same pipeline: Vault → ESO → Kubernetes Secret, declared in Git as an ExternalSecret that contains no secret material. Rotations have been exercised for real — including a full cluster CA rotation, which is exactly the drill that proves the recovery paths work.


<div class="adr-nav">
  <a href="../002-self-hosted-gitea-ci/">&larr; ADR 002 &middot; Self-hosted Gitea + CI</a>
  <a class="adr-nav-all" href="../../">ADR 3 of 14</a>
  <a href="../004-authentik-sso/">ADR 004 &middot; Authentik SSO &rarr;</a>
</div>
