---
title: kubeslo-operator
eyebrow: Side Project · Reliability
summary: A Kubernetes operator, written by hand in Go, that records every change to a workload and judges it against that workload's SLO. The groundwork is done and proven; the operator itself is just getting started.
permalink: /projects/kubeslo-operator/
---

<p class="pills-row">
  <span class="status status-wip">Early · groundwork done, operator not yet written</span>
  <span class="pill">Go · kubebuilder</span>
  <span class="pill">Public on GitHub when phase 3 lands</span>
</p>

Most outages start with a change. The cluster already knows when a change happens, and Prometheus already knows when error budgets burn. What nothing here does is **connect the two**: say *this* rollout, from *this* commit, made *this* SLO worse.

kubeslo-operator is meant to do that. It watches opted-in Deployments, writes a `ChangeRecord` for every pod-template change, and then judges each one against the SLO the workload already has: **Healthy**, **Regressed**, or **Inconclusive**.

This page is a status report, not a write-up. The write-up comes when it works.

---

## The rule for this one

This project has one rule the others don't: **I write the Go by hand.** AI reviews it, explains it, and quizzes me on it, but it doesn't author it. The point is to understand the reconcile loop well enough to write one from a blank file, not to own one. It's the one project on this site where AI is the teacher rather than the author, and the [AI-assisted engineering](../../copilot-experiments/#the-exception-where-ai-teaches-and-i-write) page says what that cost and what it bought.

---

## What's done: the groundwork

An operator that judges changes against SLOs needs SLOs, metrics, and something safe to break. None of that existed in September — the platform had [deliberately no metrics stack](../../architecture/decisions/016-observability-approach/). So the work started underneath it.

**Phase 0 — metrics and SLOs.** kube-prometheus-stack, Pyrra for SLOs and burn-rate alerts, and scraping of the Istio gateways, ztunnel, and Cilium's Hubble, so services get request metrics without being instrumented.

**Phase 1 — `flaky`, the test subject.** A small Go HTTP service, also written by hand, whose only job is to misbehave on command. Its contract is strict, because every later phase depends on it:

- **Faults come only from Git.** An error rate and an added latency, set as environment variables in the Deployment. There is no admin endpoint — a fault that doesn't change the pod template is a fault the operator would never see.
- **Metrics live on a separate port** from the work endpoint, so a fault never takes away the evidence.
- **A good release causes zero errors while it rolls out.** On SIGTERM it fails readiness, drains, and exits — otherwise every healthy rollout would look like a regression.
- **A load generator in the same binary** keeps steady traffic on it, so a ten-minute window holds thousands of requests instead of a handful.

It ships through the same pipeline as everything else, signed, because the cluster rejects unsigned images. About 930 lines of Go with table-driven tests, two SLOs (99% non-5xx, and 99% of requests under 250 ms, both over 7 days), and an Argo CD application.

### The demo that closed phase 1

On **23 October**, a commit set flaky's `ERROR_RATE` to `0.2`. Argo CD rolled it out, the error ratio went to about 20% — a 20× burn against a 99% target — and Pyrra's critical burn-rate alert fired in Prometheus **about 12 minutes after the commit**. Two minutes later a `git revert` went in, and the budget stopped burning.

That's the loop the operator has to automate, and every step of it was a person watching a graph. Not even the page was automatic yet: Alertmanager wasn't wired to deliver anywhere until two days later.

---

## What the demo taught the design

Watching it happen in a real cluster turned up constraints a textbook operator would get wrong:

- **Not every Deployment update is a release.** Kyverno and Argo CD both write annotations onto Deployments. A release is a change to the pod template — what `metadata.generation` tracks — not any update.
- **A revert reuses an old ReplicaSet.** Rolling back scaled the previous ReplicaSet up in six seconds; no new one appeared. "From" and "to" have to be read from pod templates, not inferred from new objects.
- **A config change keeps the same version.** The bad release changed an env var, not the image, so version labels can't separate old pods from new. The verdict has to compare **time windows** — before the change, and after the rollout finished.
- **"No data" is not "zero errors".** Until flaky pre-initialised its counters, the error query returned *nothing*, not 0. The operator has to tell no data, too little data, and a measured 0% apart.
- **Argo CD already knows the commit.** Its Application history records every sync's revision, so a ChangeRecord can carry the Git SHA — which is exactly what an automated revert needs later.

---

## The plan

| Phase | What | State |
|---|---|---|
| 0 | Metrics and SLOs on the platform | Done |
| 1 | `flaky`, and breaking it with a commit | Done |
| 2 | **Record every change.** kubebuilder scaffold, a `ChangeRecord` CRD, a level-triggered reconcile loop, the Argo CD source, envtest | Next |
| 3 | **Judge the change.** Query Prometheus for a baseline and an observation window, compute burn rate, record a verdict as status, Events, a metric, and Grafana annotations | Planned |
| 4 | Write it up | Planned |
| 5 | **Act on it.** A `ChangePolicy` that can annotate, alert, or revert | Sketched |

Two design choices are already fixed:

- **Opt-in, and the SLO is the source of truth.** A Deployment opts in with an annotation naming its Pyrra SLO; the operator reads the target and the queries from that SLO rather than keeping a second copy.
- **Reverting means a Git commit.** In a GitOps cluster, rolling a Deployment back directly doesn't work — Argo CD's self-heal puts the bad version straight back. The GitOps-correct revert is a commit to the repo, reviewable and auditable like any other change. That's how the demo was fixed by hand, and it's how phase 5 will do it.

### Honest caveats

**The operator repository is empty.** As of late October 2026 it holds a README. Everything above "Next" in the table is real and running; everything below it is design.

**One test subject.** flaky is built to be judged. Real workloads here have far less traffic — some services see a dozen requests an hour — and a verdict needs a few hundred requests to mean anything. Those cases will come back **Inconclusive**, by design, rather than being judged on noise.
