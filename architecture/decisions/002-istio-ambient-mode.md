# ADR 002: Use Istio in Ambient Mode (not Sidecar Mode)

**Status:** Accepted  
**Date:** 2026

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

- **No sidecars means no per-pod overhead.** One ztunnel DaemonSet per node instead of N sidecars for N pods. On a 7-node cluster with ~50 pods, the savings are meaningful.
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

Ambient mode is running across the cluster. All inter-service traffic is mTLS-encrypted transparently. I've selectively deployed waypoint proxies for services where I want L7 observability. The operational experience is genuinely lighter than sidecar mode.
