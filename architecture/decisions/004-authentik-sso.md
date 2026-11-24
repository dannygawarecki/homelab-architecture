---
title: "ADR 004: Authentik as the Identity Provider"
eyebrow: Architecture Decision Record
description: One login for everything — including the infrastructure itself — with every provider and application declared in Terraform.
permalink: /architecture/decisions/004-authentik-sso/
card_title: "Authentik as the identity provider"
card_blurb: "One login for everything — including Vault, ArgoCD, and Proxmox — declared entirely in Terraform."
layout: adr
status: Accepted
date_label: Aug 2025
subsystem: Identity · SSO
tldr: Authentik is the identity provider for everything, infrastructure included, with every provider and application declared in Terraform — at the cost of a platform-wide single point of failure for human logins.
outcome_stats:
  - num: "9"
    label: OIDC Applications Today
  - num: "2"
    label: Access Groups
---

## Context

A platform running a dozen web UIs accumulates a dozen credential stores unless identity is centralized early. I wanted single sign-on with MFA in one place, group-based authorization, and — critically — the identity configuration itself under version control.

Options:

- <span class="opt">Rejected</span> **Keycloak** — the enterprise standard; heavyweight, and its administration model is famously sprawling for a two-user deployment.
- <span class="opt">Rejected</span> **Authelia** — lean and well-liked, but at the time more portal/proxy-oriented; I wanted a full OIDC provider with a first-class Terraform provider.
- <span class="opt">Rejected</span> **Dex** — an identity *broker*, not a user store; solves federation, not the directory.
- <span class="opt opt-chosen">Chosen</span> **Authentik** — full IdP with flows, OIDC/SAML/proxy providers, and a maintained Terraform provider.

## Decision

**Authentik is the identity provider for everything.** OAuth2/OIDC provider-application pairs are generated in Terraform from a single `for_each` map — adding SSO to a new app is one map entry. (Ten at the time of writing, nine today: grocy moved to a proxy provider in [ADR 017](../017-outpost-reverse-proxy-auth/), for reasons worth reading.) Authorization is two groups: application **admins** and application **users**, bound per-application.

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

Onboarding the second user was a group membership, not ten account creations. The `for_each` pattern has held: new applications get SSO in roughly ten lines of diff.

> **Correction, Sep 2026.** This section originally opened with *"Every web surface on the platform sits behind the same login."* That was not true when it was written and had not been for some time. Seven surfaces — kiali, hubble-ui, netdata, dozzle, homepage, Stirling PDF, and grocy — had no working login, and grocy's OIDC application pointed at a callback route it has never had. All seven are now behind the outpost; see [ADR 017](../017-outpost-reverse-proxy-auth/) for the decision and [Everything Was Green](../../../writing/everything-was-green/) for how a claim like that survives a year unchallenged.
