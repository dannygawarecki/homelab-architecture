---
title: "ADR 009: Use Istio in Ambient Mode (not Sidecar Mode)"
eyebrow: Architecture Decision Record
summary: Cluster-wide mTLS without per-pod sidecars — lower overhead, simpler rollout, a younger ecosystem.
permalink: /architecture/decisions/009-istio-ambient-mode/
---

**Status:** Accepted &nbsp;·&nbsp; **Date:** Nov 2025 &nbsp;·&nbsp; [← All ADRs](../../)

---

## Context

I wanted mutual TLS (mTLS) between services in the cluster — both for security and as a learning exercise. Istio is the most mature service mesh, but traditionally it injects a sidecar proxy (Envoy) into every pod, which has real costs:

- Memory overhead per pod (~50MB per sidecar)
- CPU overhead for the proxy
- Increased pod startup time
- Complexity in debugging (two containers per pod, intercepted traffic)
- Disruption to existing workloads during injection rollout

Istio ambient mode was GA'd in Istio 1.22 (2024). It replaces per-pod sidecars with two shared components per node: **ztunnel** (L4 mTLS) and **waypoint proxies** (optional L7).

---

## Decision

Run **Istio in ambient mode** using ztunnel for cluster-wide mTLS and waypoint proxies selectively for L7 policies.

---

## Reasoning

- **No sidecars means no per-pod overhead.** One ztunnel DaemonSet per node instead of N sidecars for N pods. On a 6-node cluster with ~50 pods, the savings are meaningful.
- **Simpler rollout.** Adding a namespace to the mesh is one label. No pod restarts, no injection webhooks to worry about.
- **Same mTLS guarantees.** ztunnel enforces SPIFFE-based mTLS at L4 for all in-mesh traffic — whether or not a waypoint proxy is present.
- **Real-world experience with new tech.** Ambient mode is production-ready but still operationally novel. Running it here means I understand the tradeoffs firsthand.

---

## Tradeoffs

- **L7 features require waypoint proxies.** Traffic routing, retries, and header-based policies need a waypoint deployed per-service-account. This adds back some overhead selectively.
- **Younger ecosystem.** Less community content, fewer examples, fewer known-good configurations compared to sidecar mode.
- **Istio CNI required.** The Istio CNI plugin runs on every node and handles traffic redirection. It's an additional component that needs to be managed correctly alongside Cilium.
- **Cilium + Istio coexistence required care.** Cilium's eBPF kube-proxy replacement needed to be configured to not interfere with Istio's traffic interception.

---

## Outcome

Ambient mode is running across ~28 namespaces with mesh-wide `STRICT` mTLS enforced by a default PeerAuthentication. Outbound traffic policy is `REGISTRY_ONLY`, so external destinations require an explicit ServiceEntry. In practice I've ended up doing L7 authorization with per-namespace AuthorizationPolicies rather than waypoint proxies — no waypoints are currently deployed, which itself says something about how far L4 + AuthorizationPolicy gets you. The operational experience is genuinely lighter than sidecar mode.

*The Cilium coexistence work this required is in [Lessons Learned](../../../lessons-learned/); the CNI's own decision record is [ADR 008](../008-cilium-cni/).*


<div class="adr-nav">
  <a href="../008-cilium-cni/">&larr; ADR 008 &middot; Cilium CNI</a>
  <a class="adr-nav-all" href="../../">ADR 9 of 14</a>
  <a href="../010-cloudnative-pg/">ADR 010 &middot; CloudNativePG &rarr;</a>
</div>
