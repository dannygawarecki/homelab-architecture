---
title: "ADR 016: Targeted Observability Tools, Not a Single Pane of Glass"
eyebrow: Architecture Decision Record
summary: I ran a full APM stack, retired it, and replaced it with narrow tools that each answer one question — accepting that nothing correlates across layers.
permalink: /architecture/decisions/016-observability-approach/
---

**Status:** Accepted &nbsp;·&nbsp; **Date:** Aug 2026 &nbsp;·&nbsp; [← All ADRs](../../)

---

## Context

The obvious answer to observability on Kubernetes is a metrics-and-traces platform: Prometheus and Grafana, or an all-in-one like SigNoz. I did that. **SigNoz ran on this cluster — traces, metrics, and logs, ClickHouse underneath — and it is now archived.**

The honest reason it went away is that its cost was constant and its use was occasional. It was one of the heaviest things on the platform, and the questions I actually had at 11pm were narrower than what it was built to answer: *is this service up, which pod is eating RAM, why can't these two pods talk, is this AuthorizationPolicy doing what I think.*

So the question became: what's the smallest set of tools that answers the questions I really ask, and what am I giving up by not having one place that answers all of them?

## Decision

Run **narrow tools scoped to specific layers**, and accept that there is no unified pane of glass. Deliberately, there is **no Prometheus and no Grafana** on this platform.

| Question | Tool |
|---|---|
| Is it up, from outside? | **Uptime Kuma** — 37 black-box HTTP monitors |
| How is this node/container doing? | **Netdata** — per-node real-time metrics |
| What are pods requesting vs. using? | **metrics-server** + **Goldilocks** for right-sizing recommendations |
| What is this container logging? | **Dozzle** |
| Who is actually talking to whom? | **Hubble** — Cilium flow observability, UI newly exposed |
| Is my mesh *configuration* correct? | **Kiali** — Istio config validation |
| Did something break overnight? | **CronJobs → ntfy** — cluster alerts, security summaries, backup staleness |

**Kiali is the interesting one, because it is deliberately not doing what Kiali usually does.** Its Prometheus integration is *disabled*. It's deployed to validate Istio configuration — across roughly seventy AuthorizationPolicies, catching the misconfigurations that are otherwise invisible until traffic mysteriously fails. It runs view-only, behind an authorization policy that admits only the ingress gateway, with read-only enforced at the Kubernetes RBAC layer rather than trusted to the UI.

Two facts about [ambient mode](../009-istio-ambient-mode/) make that the right call rather than a compromise: ztunnel emits only L4 counters, and the mesh currently runs exactly one waypoint proxy. There is very little L7 telemetry to graph. Standing up Prometheus to feed Kiali traffic graphs would mean operating a metrics stack to visualize data the mesh isn't producing.

## Reasoning

- **Each tool answers a question I actually ask,** at a fraction of the operating cost of a platform that answers all of them.
- **Alerting is push, not dashboards.** The failure mode of dashboards is that nobody looks at them. Backup staleness, cluster problems, and security scan results push to my phone via ntfy; the daily backup alert has caught real failures.
- **Hubble and Kiali cover the layers that are genuinely hard to reason about.** With Cilium egress lanes ([ADR 008](../008-cilium-cni/)) and mesh-wide `STRICT` mTLS, "why can't A reach B?" has several possible answers across two dataplanes. Hubble shows the flow; Kiali shows whether the policy says what I meant.
- **Nothing here needs a database I have to back up.** Every tool is either stateless or trivially rebuildable — which matters given the backup layering in [ADR 012](../012-layered-backup-strategy/).

## Tradeoffs

These are real, and I'd be the first to flag them in a design review:

- **No distributed tracing at all.** SigNoz had it and I gave it up. For a mostly-request/response homelab it hasn't bitten me; on a platform with real service-to-service depth, this would be the wrong call.
- **No historical metrics.** Netdata is excellent in the moment and near-useless for "was this worse last Tuesday?" There is no long-term retention, so capacity trends and slow regressions are invisible. This is the tradeoff I'm least comfortable with.
- **Nothing correlates.** A latency problem means checking Netdata, Hubble, and container logs by hand and holding the timeline in my head. One pane of glass exists for a reason; I've chosen to do that correlation myself.
- **Black-box monitoring only catches down, not degrading.** Uptime Kuma tells me a service stopped answering. It won't tell me it's answering slowly.
- **Kiali without metrics is half a Kiali.** I get config validation and no traffic graphs — a deliberate subset, but a subset.

## Outcome

The platform's day-to-day operational questions get answered faster than they did with the full stack, because each tool is pointed at one layer and nothing needs interpreting through a query language. The alerts that matter arrive on my phone without me opening anything.

The honest summary: **this is the right architecture for a single operator running a homelab, and the wrong one for a team running a product.** The moment more than one person is on call, or anything here becomes latency-sensitive for someone other than me, the correlation problem stops being a minor inconvenience and Prometheus goes back in.


<div class="adr-nav">
  <a href="../015-tailscale-remote-access/">&larr; ADR 015 &middot; Tailscale remote access</a>
  <a class="adr-nav-all" href="../../">ADR 16 of 16</a>
  <span></span>
</div>
