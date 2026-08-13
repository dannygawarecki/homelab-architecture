---
title: "ADR 001: GitOps with ArgoCD (App of Apps Pattern)"
eyebrow: Architecture Decision Record
summary: One root Application bootstraps the entire cluster. Git is the only way in.
permalink: /architecture/decisions/001-gitops-argocd/
---

**Status:** Accepted &nbsp;·&nbsp; **Date:** July 2025 &nbsp;·&nbsp; [← All ADRs](../../)

---

## Context

I needed a way to manage Kubernetes workloads that was:

- Reproducible — the cluster state should be fully recoverable from Git
- Auditable — every change tracked, with a clear author and reason
- Safe — no one (including me) should be making ad-hoc `kubectl apply` changes in production
- Scalable — adding a new application should be low-friction and consistent

Options considered: ArgoCD, plain Helm + CI pipelines, manual management.

---

## Decision

Use **ArgoCD** with the **App of Apps** pattern. A single root `Application` points to a directory of other `Application` manifests, each managing an individual service or platform component.

---

## Reasoning

- **ArgoCD has a UI.** Being able to see sync status, resource trees, and health at a glance is genuinely useful for a single-operator homelab.
- **App of Apps scales cleanly.** Adding a new service is: create a directory with Helm values + an Application manifest. ArgoCD picks it up automatically.
- **Sync policies give control.** I use auto-sync with self-heal for platform components (Cilium, cert-manager, ESO) and manual sync for applications where I want to review changes before applying.
- **SSO integration.** ArgoCD authenticates via Authentik (OIDC), so there's one place to manage access.

---

## Tradeoffs

- **ArgoCD itself must be bootstrapped.** The chicken-and-egg problem: ArgoCD manages itself, but someone has to install it first. I use a Helm install via Terraform for the initial bootstrap, then hand it off to ArgoCD to manage its own upgrades.
- **Secrets in Git is a non-starter.** ArgoCD doesn't solve secrets. This is why ESO + Vault is a hard requirement — ArgoCD only manages non-secret manifests.
- **Drift between Helm chart defaults and ArgoCD values.** When upstream Helm charts add new default values, ArgoCD can show drift even when nothing intentionally changed. Requires occasional `ignoreDifferences` tuning.

---

## Outcome

Every workload in the cluster is managed through ArgoCD. The cluster can be (and has been) fully rebuilt from the home-lab-argocd repo. The root application bootstraps everything else in dependency order.


<div class="adr-nav">
  <span></span>
  <a class="adr-nav-all" href="../../">ADR 1 of 14</a>
  <a href="../002-self-hosted-gitea-ci/">ADR 002 &middot; Self-hosted Gitea + CI &rarr;</a>
</div>
