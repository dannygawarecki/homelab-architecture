---
title: "ADR 021: Credentials Rotate on a Clock"
eyebrow: Architecture Decision Record
description: "Every generated credential the platform owns now has an expiry date in Terraform. Which engine applies it is decided by blast radius: a nightly runner for what a scoped key can mint, and a human apply for what needs root."
permalink: /architecture/decisions/021-credential-rotation/
card_title: "Credentials rotate on a clock"
card_blurb: "Database passwords, service tokens, OIDC secrets and provider keys all rotate on Terraform clocks. A nightly runner handles what a scoped key can mint; anything that needs root waits for a human apply, on purpose."
layout: adr
status: Accepted
date_label: Sep 2026
subsystem: Security · Secrets
builds_on: ["003"]
tldr: A time_rotating clock decides when each credential changes, and whatever runs Terraform is the engine. A nightly, unattended runner in its own repository rotates database passwords and Gitea service tokens with a scoped Vault AppRole; credentials that only root can mint rotate on the next human apply. Accepted costs are that the first apply of each credential is itself a rotation, a short window where a consumer holds a dead token, and a human tier that rotates only as often as I apply.
outcome_stats:
  - num: "20"
    label: Credentials on the nightly runner
  - num: "19"
    label: Clocks on the human-applied tier
  - num: "60–180"
    label: Days between rotations
---

## Context

[ADR 003](../003-vault-external-secrets/) made Vault the only path a secret takes into the cluster, and it said rotation would be "an edit, not a redeploy". That was true and beside the point: nothing ever made the edit. By September 2026 almost every generated credential on the platform was permanent. Database passwords had been set once at install, Gitea service tokens never expired, and the MinIO key CNPG streams its WAL archive with would have stayed valid until someone deleted it by hand.

The [Everything Was Green](../../../writing/everything-was-green/) weekend is where that became impossible to ignore. Automating three certificate renewals needed three service accounts, which meant the project created three long-lived credentials to retire three short-lived ones. Making those rotate forced everything underneath: a runner, Terraform state somewhere a runner could reach, a scoped Vault AppRole, and a Vault layout regular enough to write a policy against. Certificates rotate on their own, with cert-manager and three appliance CronJobs; this record is about everything else.

## Decision

**Rotation is a decision recorded in Terraform, not an event someone remembers.** Each credential hangs off a `time_rotating` clock. When the clock passes, the credential's `keepers` change, Terraform generates a new value and writes it to Vault, and the existing pipeline delivers it:

```
Vault KV
  ├─ External Secrets (≤1 min) → database role secret → CloudNativePG updates the role
  └─ External Secrets (≤1 min) → application secret   → Reloader restarts the consumer
```

The clock is the *decision*. The *engine* is whatever runs `terraform apply`, and there are two, chosen by what minting the credential requires:

| Tier | Engine | What it rotates | Every |
|---|---|---|---|
| **Unattended** | A nightly job at 03:17, in its own repository | 8 Postgres passwords, 1 Redis password, 11 Gitea service tokens | 90 days |
| **Human-applied** | The next hand-run apply of the main Terraform after a clock passes | OIDC client secrets, Authentik and Proxmox API tokens, the Authentik signing key, MinIO service accounts, Backblaze and Cloudflare keys, the Vault MCP token, and others | 60–180 days |

## Reasoning

- **The unattended runner can only do what it's for.** It holds a Vault AppRole scoped to the KV paths it rewrites and a MinIO key scoped to its own state prefix. Its policy lives in the *other* repository, so it can't widen its own permissions. Adding an application means changing that policy first, by hand, and the friction is deliberate.
- **Anything that needs root stays off the schedule.** Minting a MinIO service account needs the MinIO root credential, and that credential can read the main Terraform state, which holds every generated password in cleartext. A nightly job with root would undo the whole separation in one line. The same goes for the Backblaze master key and the provider tokens that can mint other tokens. Those rotate when I apply, and the comments in the Terraform say why, so nobody later "fixes" it by scheduling them.
- **The meta-credential never touches state.** The account that mints Gitea tokens is read from Vault as an `ephemeral` value, so it never lands in the state file the runner itself can read.
- **One clock per family, on purpose.** All the database passwords share one clock and all the OIDC secrets share another. Staggering would spread the risk out, but it would also create a dozen separate windows in which something can fail quietly, and no single moment at which the whole mechanism is known to work.
- **Never two changes in one window.** Database passwords rotate at 03:17, and the three appliance certificates at 04:17, 04:52 and 05:27. The Gitea token clock started a day after the database clock, so their 90-day cycles stay a day apart. If something breaks at 04:20, there's one obvious cause, not two.
- **Every rotation is loud.** A successful rotation sends a high-priority notification naming the applications it touched, because if one of them is broken five minutes later, that message is the only thing connecting the break to its cause. A failed apply sends an urgent one: Vault may now hold a password the database doesn't.
- **`keepers`, not `replace_triggered_by`, where it matters.** `replace_triggered_by` doesn't fire on the apply that creates the clock, so a mechanism wired that way sits unexercised until its first rotation is due. `keepers` changes the moment the clock does. That difference is how the MinIO accounts nearly shipped unproven.
- **Expiry where failure is loud, none where it's silent.** Backblaze and Cloudflare keys carry a hard expiry at twice their clock, because a dead key there fails a job that pages. The MinIO backup keys carry none, because a dead credential on the WAL archive would fail silently, and a key that outlives its rotation is the safer failure.

## Tradeoffs

- **The first apply is a rotation.** Terraform can't adopt an existing password and rotate it later: importing leaves `keepers` empty, and adding them forces a new value. So every credential's adoption was a live change. Each was run by hand and traced end to end, with a real `psql` connection rather than a Secret that merely changed. Paperless went first, because it's used enough that a break gets noticed and nothing depends on it. **Gitea went last, and alone**: if its database credential breaks, Argo CD can't read the manifests you'd use to fix it.
- **There's still a short window.** Tokens are minted before the old ones are revoked, with the mint date in the token name so generations never collide. But between the revoke and External Secrets' next refresh, a consumer holds a dead credential. The ExternalSecrets in the chain were lowered from a one-hour to a one-minute refresh to keep that to about ninety seconds. A true two-phase rotation would close it, at the cost of hand-managing a second generation of every resource.
- **A rotation restarts things.** Reloader restarts each consumer, and an app running one replica with Recreate (Worth Keeping, for one) has a brief outage rather than a seamless swap. At 03:17, every ninety days, that's accepted.
- **The human tier rotates only as often as I apply.** A clock passing isn't a rotation; it's a pending change on the next plan. That's the price of keeping root out of the schedule.

## Outcome

Built over 4–6 September 2026, and extended to each new application as it arrived (Worth Keeping's database credential joined on 20 September). The nightly job has run since then, and on almost every night it's correctly a no-op: the plan is empty and it reports "No rotation due."

Honest status: **every credential has been rotated at least once, by hand and watched, at adoption.** The first rotation the schedule performs entirely on its own is the 90-day database clock, due in early December 2026. Until that runs and the morning notification is followed by working applications, the unattended path is proven in every part except the one that matters most: doing it with nobody watching.
