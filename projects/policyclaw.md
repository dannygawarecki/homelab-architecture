---
title: Policyclaw
eyebrow: Side Project · AI Governance
summary: A policy gateway that put every mutating AI action behind a human confirmation gate — a working first-generation answer to "how do you let an agent touch production safely?" whose lesson now lives in Cortexa.
permalink: /projects/policyclaw/
---

<p class="pills-row">
  <span class="status status-wip">Archived · first-generation governance, now a design input to Cortexa</span>
</p>

Policyclaw is the **governance** chapter of a longer story ([the through-line is here](../)). It answered a need the [MCP layer](../../architecture/decisions/013-mcp-ai-operations/) created and didn't solve: once an assistant can *touch* real systems, something has to decide what it's allowed to do — and force a human into the loop before anything irreversible happens.

It isn't running today. It was never a product; it was infrastructure, and a prototype. But it worked, and building it is how I learned that governance doesn't belong in a separate proxy — it belongs inside the collaborator. That realization is a straight line into [Cortexa](../cortexa/).

---

## The discovered need

The MCP layer gave AI tooling structured, credential-contained access to eleven platform systems. That's agency — and agency is exactly what you want to be nervous about. A read-only query against the Kubernetes API is harmless. A write against Vault, or a delete against Talos, is not. Authentication scoping and network policy contain *who* can reach a server; they say nothing about *which specific action* is about to run, or whether a human should see it first.

Nothing in the stack put a person in the loop at the moment of a dangerous call. Policyclaw was built to be that thing.

---

## What it was

A gateway, written in Go, that sat between the AI client and the MCP servers. Every tool call was routed through it, classified, and either passed or held:

- **An OPA sidecar** (Open Policy Agent) evaluated each call against Rego policy. Keeping policy in OPA rather than in application code meant the rules were declarative, inspectable, and changeable without a rebuild.
- **Per-backend risk tiers.** Each of the eleven MCP backends carried a tier. Read-only surfaces (Kubernetes queries, MinIO reads) were `allow` — they flowed straight through. Mutating or high-blast-radius surfaces (Vault, CloudNativePG, Synology, Talos, ArgoCD) were `require_confirmation`.
- **A human confirmation gate.** A `require_confirmation` call didn't execute. It paused, surfaced exactly what was about to happen, and waited for an explicit human yes. Confirmations were persisted to a volume, so the decision survived restarts rather than evaporating mid-session.

The design principle: **the model proposes; code disposes.** An agent could *ask* to do anything, and the dangerous asks were rendered as a decision a person had to actively make — not something buried in a stream of autonomous actions.

---

## Why it's shelved — and where it went

Policyclaw worked. But standing it up taught me it was the wrong *shape*. A confirmation gateway you have to remember to route through is opt-in governance: it protects you exactly as long as every client is pointed at it and nobody talks to an MCP server directly. Governance that lives beside the thing it governs is governance you can bypass.

The right shape puts that judgment *inside* the collaborator, as an invariant it can't route around. Which is precisely what [Cortexa](../cortexa/) does with its code-owned memory handshake: the model can propose that something be remembered, but only deterministic code writes it, and only after explicit human approval whose wording code renders. I arrived at that design in Cortexa independently — and then recognized it as Policyclaw's confirmation gate, one layer up and built-in rather than bolted-on.

So Policyclaw isn't being maintained. Its lesson graduated:

- The **confirmation-gate concept** is now Cortexa's approval handshake — an architectural invariant, not an optional proxy.
- The **risk-tier idea** — that actions carry blast radius and the dangerous ones deserve a different path — is the seed of how a governed Cortexa will drive the still-live MCP layer.

That's the honest arc: a working prototype whose real product was the design it pointed at. It's archived in the GitOps repo, and it earned its place there.
