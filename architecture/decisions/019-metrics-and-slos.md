---
title: "ADR 019: Prometheus Goes Back In, for SLOs"
eyebrow: Architecture Decision Record
summary: Two months after deciding against a metrics stack, I installed one — not for dashboards, but because error budgets need history, and the next project needs error budgets.
permalink: /architecture/decisions/019-metrics-and-slos/
card_title: "Prometheus goes back in, for SLOs"
card_blurb: "Two months after deciding against a metrics stack, I installed one — scoped to SLOs and burn-rate alerts, with request metrics taken from the mesh instead of from the apps."
layout: adr
status: Accepted
date_label: Oct 2026
subsystem: Observability
supersedes: ["016"]
tldr: kube-prometheus-stack with 7-day retention, request metrics scraped from the Istio gateways and Cilium rather than instrumented into apps, Pyrra SLOs with burn-rate alerts, and every alert through one notification gateway — still no logs pipeline and no tracing.
outcome_stats:
  - num: "4"
    label: SLOs with burn-rate alerts
  - num: "7 days"
    label: Metrics retention
  - num: "1"
    label: Front door to the phone
---

## Context

[ADR 016](../016-observability-approach/) decided against Prometheus and Grafana, and named its own exit condition: the tradeoff it was least comfortable with was **no historical metrics**, and it said that when that stopped being a minor inconvenience, "Prometheus goes back in."

Two things made that happen in October 2026.

The first was a question ADR 016's tools couldn't answer at all: **is this service meeting its objective?** Uptime Kuma says up or down. Netdata says what's happening right now. Neither can say "authentik has spent 40% of this week's error budget," because that needs a week of request counts. For someone who practises SRE for a living, a platform with no SLOs on it is a conspicuous gap.

The second was the next project. [kubeslo-operator](../../../projects/kubeslo-operator/) judges each rollout against the workload's SLO. It needs SLO definitions, burn rates, and a baseline from before the change. That's Prometheus by definition.

## Decision

Install **kube-prometheus-stack** through Argo CD, and point it at SLOs rather than dashboards.

- **Prometheus, 7-day retention**, capped at 15 GB on a 20 GiB Synology volume. One replica. Selectors are open, so a `PodMonitor` in any namespace is picked up without touching the stack.
- **Request metrics from the mesh, not from the apps.** Both Istio ingress gateways are scraped, which gives request rate, response codes, and latency for everything behind them — no app had to change. ztunnel and istiod are scraped for the mesh itself, Cilium's agent, operator, and Hubble metrics for drops, DNS, and policy verdicts, and vLLM for its native inference metrics.
- **SLOs with Pyrra.** A short `ServiceLevelObjective` resource generates the recording rules and the multi-window burn-rate alerts. Four exist, all over 7 days to match retention:

| SLO | Target | Measured from |
|---|---|---|
| Authentik availability | 99.5% non-5xx | The ingress gateway |
| vLLM time to first token | 99% under 2.5 s | vLLM's own histogram |
| flaky availability | 99% non-5xx | The app's counter |
| flaky latency | 99% under 250 ms | The app's histogram |

- **Grafana and Pyrra behind Authentik**, through the same embedded-outpost pattern as [ADR 017](../017-outpost-reverse-proxy-auth/). Grafana has no volume; dashboards and data sources come from ConfigMaps in Git.
- **One front door to the phone.** Alertmanager delivers to the **notification gateway**, a small in-cluster relay that already sat in front of ntfy for Falco and Tetragon. Every other producer — the alert CronJobs, Argo CD notifications, backup jobs, Uptime Kuma — was moved onto it too. It enforces severity floors, an hourly cap, and secret scrubbing, and it has a **maintenance mode**: a rolling Proxmox upgrade turns it on for the whole run, and everything arrives silently except the upgrade's own failures.
- **Kiali gets its Prometheus.** ADR 016 ran it deliberately without one. It now draws traffic graphs from the same Prometheus.

What stays out: **no logs pipeline** (Loki) and **no tracing** (Tempo). Dozzle still answers "what is this container logging," and nothing here has needed a trace yet.

## Reasoning

- **SLOs are the reason, so SLOs set the shape.** Seven days of retention is short for capacity planning and exactly right for a 7-day error budget. Choosing the window first kept the storage bill small.
- **The gateways already see the requests.** In ambient mode, ztunnel is L4-only ([ADR 009](../009-istio-ambient-mode/)), so there's no free per-service L7 telemetry inside the mesh. But everything users touch comes in through a gateway, and the gateways are full Envoys. Scraping two pods covers dozens of services.
- **Burn rates, not thresholds.** A burn-rate alert asks "at this pace, will we run out of budget?" — which fires fast on an outage and stays quiet on a blip. Writing those rules by hand is error-prone; Pyrra generates them from four lines of intent.
- **One gateway for alerts** means one place for rate limits, scrubbing, and maintenance windows, instead of a dozen producers each deciding how loudly to ring.

## Tradeoffs

- **It's a stateful system again.** The thing ADR 016 was proud of — nothing needs a database I have to back up — is no longer true. Prometheus has a volume on the array. It isn't in the offsite backup ([ADR 018](../018-offsite-backup/)), and I'm comfortable with that: seven days of metrics is cheaper to lose than to store.
- **It cost more than the chart's defaults.** The API server alone was 178,000 of the first 273,000 series, almost all of it histogram buckets nothing reads. They're dropped at scrape time. Talos binds etcd, the scheduler, and the controller manager to localhost, so those default targets are switched off rather than left permanently red.
- **An SLO can lie quietly.** For its first week, the Authentik SLO reported **exactly 100% availability** while 13 real 5xx responses happened. One selector used `!=` where Pyrra needed `!~`; the total series lost its labels, the error lookup matched nothing, and a fallback to zero pinned the result at 1. The burn-rate alerts were unaffected, which is why nothing looked wrong. The same bug was in the flaky SLO and was fixed the same way. A metric that's green because it's broken is the failure I trust least.
- **Low-traffic services can't have meaningful SLOs.** big-ads is served from Cloudflare R2, so the cluster never sees its readers. big-recipes gets about a dozen requests an hour — roughly what Uptime Kuma's probes produce. An SLO over that is noise. If either gets one, it'll be a freshness or probe SLO, not a request ratio.
- **Two paging paths, for now.** Alertmanager has delivered only since 25 October. Netdata still pages in parallel for a parity week before it's retired, and the two will overlap until then.

## Outcome

The stack has been up since 11 October. The first real test was deliberate: a commit that made [flaky](../../../projects/kubeslo-operator/) fail 20% of its requests drew the critical burn-rate alert in about twelve minutes, and a `git revert` stopped the burn. Alertmanager wasn't yet delivering anywhere, so that alert only reached the Prometheus UI — the wiring that would have put it on my phone landed two days later.

The honest summary of ADR 016 still holds — narrow tools are the right shape for one operator — and this record doesn't contradict it so much as cash in the exit clause it wrote. What changed is that I now need to answer a question about **objectives**, not just state. That question needs history, and history needs Prometheus.

> **Update (Nov 2026):** The parity week ran long, 25 October to 19 November, on one rule: anything Netdata caught that Alertmanager didn't was a gap to close before Netdata could go. It earned its keep. Netdata raised 14 critical alerts in that window. Two were false positives. The other twelve were real: three out-of-memory kills (cnpg-mcp twice, Grafana once) that **Prometheus fired nothing for**. kube-prometheus-stack ships no rule for a container at its memory limit, and an OOM only surfaces as a crash loop if it keeps happening. Two rules closed the gap, backtested against the same week to fire on all three. Then Netdata was retired, and the overlap ended.
