---
title: "ADR 008: Cilium as the CNI, with kube-proxy Replaced"
eyebrow: Architecture Decision Record
summary: eBPF networking with kube-proxy fully replaced, and an egress "lanes" model that makes internet access an explicit, reviewable choice.
permalink: /architecture/decisions/008-cilium-cni/
---

**Status:** Accepted &nbsp;·&nbsp; **Date:** Nov 2025 &nbsp;·&nbsp; [← All ADRs](../../)

---

## Context

Talos ships with Flannel by default, and it works — so this was a decision to *replace* a working default, not to fill a hole. (The k0s-era cluster likely defaulted to Flannel too; I did little with the CNI back then and it didn't much matter.) What changed the calculus was two things I actually wanted: real network policy, and the move to Istio ambient mode ([ADR 009](../009-istio-ambient-mode/)) — where Cilium turned out to be a powerful ally rather than just a CNI. To run it, I set Talos to `cni: none` and `proxy.disabled: true` and let Cilium own both jobs.

Options:

- **Flannel** — what Talos ships by default. Simple, boring, and essentially policy-free. Fine for connectivity, nothing for the egress control I was after.
- **Calico** — a mature policy engine and a real contender.
- **Cilium** — eBPF-native, full kube-proxy replacement, FQDN-aware egress policy, Hubble for flow-level observability, and the smoothest coexistence story with Istio ambient.

## Decision

**Cilium as the sole CNI**, running in kube-proxy replacement mode (there is no kube-proxy on the cluster at all), with `cni.exclusive: false` so it chains correctly with Istio's CNI plugin. Hubble relay and UI are enabled.

Bootstrap ordering matters: Cilium is installed once, immediately after Talos bootstrap, via `helm template | kubectl apply` — deliberately *not* `helm install`, so no Helm release object exists to conflict with ArgoCD, which adopts and manages the same resources from its first sync onward.

## Reasoning

- **Policy is the point.** Egress control is organized as **lanes**: Lane A (`egress-cluster-and-lan-only`) applies to 18 namespaces and permits traffic only within the cluster and the LAN — no public internet, full stop. Lane B grants specific namespaces FQDN allowlists through Cilium's DNS proxy (the Checkov scanner may reach the Terraform registry and GitHub; the metrics agent may reach its cloud endpoint; nothing else).
- **A new workload gets internet access by a Git change, not by default.** That's the enforcement behind the site's "networking has teeth" claim.
- **kube-proxy replacement** removes an entire component and its iptables churn; service routing is eBPF.
- **Hubble** answers "what is actually talking to what" with flow data, which repaid itself during every mesh and MTU debugging session.

## Tradeoffs

- **Two networking dataplanes on every node.** Cilium and Istio ambient's ztunnel both touch traffic; making them coexist required specific configuration and care — documented in [ADR 009](../009-istio-ambient-mode/) and [Lessons Learned](../../../lessons-learned/).
- **eBPF debugging is its own skill.** When something is wrong below the pod, the tooling is `cilium` CLI and Hubble, not tcpdump intuition.
- **FQDN policies depend on Cilium's DNS proxy.** Lane B only works if DNS flows through it — a subtle coupling that has to be preserved through upgrades.

## Outcome

Egress denial is the default posture for application namespaces. Policy lives in Git next to the workloads it governs, and Hubble provides the evidence when a policy is wrong. Cilium has survived Talos upgrades and the Istio ambient rollout intact.


<div class="adr-nav">
  <a href="../007-talos-linux/">&larr; ADR 007 &middot; Talos Linux</a>
  <a class="adr-nav-all" href="../../">ADR 8 of 14</a>
  <a href="../009-istio-ambient-mode/">ADR 009 &middot; Istio ambient mode &rarr;</a>
</div>
