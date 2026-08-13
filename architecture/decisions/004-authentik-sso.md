---
title: "ADR 004: Authentik as the Identity Provider"
eyebrow: Architecture Decision Record
summary: One login for everything — including the infrastructure itself — with every provider and application declared in Terraform.
permalink: /architecture/decisions/004-authentik-sso/
---

**Status:** Accepted &nbsp;·&nbsp; **Date:** Aug 2025 &nbsp;·&nbsp; [← All ADRs](../../)

---

## Context

A platform running a dozen web UIs accumulates a dozen credential stores unless identity is centralized early. I wanted single sign-on with MFA in one place, group-based authorization, and — critically — the identity configuration itself under version control.

Options:

- **Keycloak** — the enterprise standard; heavyweight, and its administration model is famously sprawling for a two-user deployment.
- **Authelia** — lean and well-liked, but at the time more portal/proxy-oriented; I wanted a full OIDC provider with a first-class Terraform provider.
- **Dex** — an identity *broker*, not a user store; solves federation, not the directory.
- **Authentik** — full IdP with flows, OIDC/SAML/proxy providers, and a maintained Terraform provider.

## Decision

**Authentik is the identity provider for everything.** Eleven OAuth2/OIDC provider-application pairs are generated in Terraform from a single `for_each` map — adding SSO to a new app is one map entry. Authorization is two groups: application **admins** and application **users**, bound per-application.

The deliberate part is scope: not just user apps (Paperless, Outline, Home Assistant, and the rest) but the **infrastructure itself** — Vault, ArgoCD, Gitea, and even Proxmox authenticate against Authentik via OIDC.

## Reasoning

- **One place for credentials and MFA**, one place to disable a person.
- **Declarative identity.** Providers, applications, groups, and users are Terraform resources; an SSO misconfiguration is a reviewable diff, not a console mystery.
- **Group-based access at the door.** The admins/users split gates each application before any app-level authorization runs.
- **Infrastructure SSO is the differentiator.** Logging into Vault or Proxmox with the same OIDC identity — with policy mapped to groups — is the pattern enterprises want and homelabs skip.

## Tradeoffs

- **The IdP is a platform-wide single point of failure for humans.** If Authentik is down, every UI's front door is locked. The break-glass path is real and broad: the original local admin account I used to stand each service up — Gitea, Vault, ArgoCD, and essentially everything else — still works independently of SSO. Nearly every app has a local admin that bypasses Authentik entirely.
- **Circular dependency during recovery.** Authentik runs *on* the platform (its database is the CNPG cluster) while gating access *to* the platform. Recovery ordering has to bring Postgres and Authentik up before SSO works anywhere.
- **Heavier than Authelia** for what is ultimately a two-user directory. Accepted for the Terraform provider and the protocol breadth.

## Outcome

Every web surface on the platform sits behind the same login. Onboarding the second user was a group membership, not eleven account creations. The `for_each` pattern has held: new applications get SSO in roughly ten lines of diff.


<div class="adr-nav">
  <a href="../003-vault-external-secrets/">&larr; ADR 003 &middot; Vault + External Secrets</a>
  <a class="adr-nav-all" href="../../">ADR 4 of 14</a>
  <a href="../005-synology-iscsi-storage/">ADR 005 &middot; Synology iSCSI storage &rarr;</a>
</div>
