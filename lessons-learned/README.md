---
title: Lessons Learned
eyebrow: Operations
summary: Three rebuilds from scratch. One data loss. Honest notes on what broke, what I underestimated, and what I'd do differently.
permalink: /lessons-learned/
---

Real operational experience from running this platform. Not polished postmortems — honest notes on what broke, what I underestimated, and what I'd do differently.

This cluster has been rebuilt from scratch three times. I lost data once. Each rebuild left the platform in a better state than it was before — but they weren't planned improvements. They were recoveries. That's the most useful kind of learning.

---

## The k0s → Talos Migration

I started the early homelab on bare-metal k0s with the server treated as pets. That worked until it didn't. The core problem: when something went wrong at the OS level, the answer was always "log in and fix it." That's fine until you're three layers deep into a workaround and you can't remember what the original state was supposed to look like.

I also fought hard to get GPU passthrough working into containers on k0s. That battle is over — I lost it completely. The combination of container runtime, kernel driver, and k0s networking never came together in a way that was workable.

Moving to Talos + Proxmox VMs changed the mental model entirely. Nodes are disposable. If something is wrong at the OS level, you don't fix it — you rebuild it. GPU passthrough on Talos worked on the first serious attempt.

**Lesson:** Treat your nodes as cattle from the start. The discipline of keeping everything declarative and reproducible pays back every time something breaks.

*The decision this experience drove: [ADR 007 — Talos Linux as the Kubernetes OS](../architecture/decisions/007-talos-linux/).*

---

## Cilium + Istio CNI Coexistence

Running two CNI-adjacent components on the same node requires careful ordering and configuration. Cilium's eBPF kube-proxy replacement and Istio's traffic interception both operate at the network layer. Getting them to coexist without one clobbering the other's routing rules took iteration — specifically around Cilium's `kubeProxyReplacement` settings and Istio's `cni.chained` mode.

**Lesson:** Read both projects' docs on CNI chaining before assuming they'll "just work." Test with a minimal workload before rolling out across the cluster.

**Postscript, Oct 2026: they coexisted, and one quietly cancelled the other.** I added an Istio waypoint to enforce per-service login on the MCP servers, and in-mesh traffic walked straight past it. With kube-proxy replacement, Cilium load-balances Services at `connect()` inside every pod, so a call to a Service IP was rewritten to a pod IP before Istio ever saw it. No Service-level waypoint had *ever* applied to in-mesh traffic on this cluster. The config said socket load-balancing was off (`bpf-lb-sock=false`); `cilium-dbg status` said "Socket LB: Enabled, Coverage: Full". With kube-proxy replacement on, that key doesn't turn it off. The fix was one documented setting, `socketLB.hostNamespaceOnly`. The lesson is the one underneath: **when a security control depends on a config value, check the running status, not the config file.**

*Why ambient mode was worth this fight: [ADR 009 — Istio in ambient mode](../architecture/decisions/009-istio-ambient-mode/).*

---

## Terraform State and Provider Drift

The `bpg/proxmox` Terraform provider sometimes generates plan diffs for resources that haven't actually changed — particularly around `cdrom` blocks and `boot_order`. This caused noisy plans where Terraform wanted to "add" a CD-ROM drive that Proxmox already had or remove boot order entries that existed in state but not config.

**Lesson:** When you see recurring plan noise, check whether it's config drift (fix the config to match state) or provider normalization behavior (add `lifecycle.ignore_changes` or remove the unmanaged attribute). Don't blindly apply noisy plans.

---

## Secrets Sprawl Before Vault

Early on, some secrets were managed ad-hoc — in Kubernetes Secrets created manually, in ArgoCD's credential store, or hardcoded in values files. Retrofitting everything through External Secrets Operator and Vault required hunting down every secret reference.

**Lesson:** Establish the secrets management pattern (ESO + Vault) before deploying the first workload, not after. Retrofitting is painful.

*The architecture that replaced the sprawl: [ADR 003 — Vault + External Secrets Operator](../architecture/decisions/003-vault-external-secrets/).*

---

## Networking Deeper Than Expected

I expected to configure VLANs and move on. Instead, VLANs pulled me into MTU sizing, VLAN trunk configurations on Unifi switches, corosync heartbeat traffic isolation, and eventually Cilium egress policies. Each change that "should have been simple" had a dependency I hadn't accounted for.

The MTU issues were the worst. A misconfigured MTU silently degrades performance and causes intermittent failures that don't point at themselves. Traffic flows, but large packets get fragmented or dropped, and the symptoms look like application bugs, not network bugs.

**Lesson:** When you hit intermittent failures that don't reproduce consistently — especially after a network change — check MTUs before anything else. And document your VLAN/MTU decisions as you make them, not after.

---

## GPU Passthrough Chain Complexity

Getting GPU passthrough working end-to-end (Proxmox PCIe passthrough → Talos Linux → NVIDIA device plugin → Kubernetes pod scheduling → Ollama) involves more moving parts than it looks:

- Proxmox host IOMMU configuration
- Talos custom image with NVIDIA kernel extensions
- NVIDIA device plugin DaemonSet configuration
- Pod resource requests (`nvidia.com/gpu: 1`)
- Ollama model loading behavior with limited VRAM

Each layer can fail silently in ways that look like the next layer's problem.

**Lesson:** Test each layer independently before stacking them. Validate IOMMU groups before assuming passthrough will work. Check `talosctl dmesg` for kernel-level GPU detection before debugging at the Kubernetes layer.

*What this stack unlocked: [ADR 011 — Local LLM inference](../architecture/decisions/011-local-llm-inference/), which now serves [Cortexa](../projects/cortexa/) and [Context Engine](../projects/context-engine/).*

---

## UptimeKuma Monitor Management

Starting with one-resource-per-monitor in Terraform created a lot of boilerplate. Refactoring to a `for_each` pattern driven by a `locals` map reduced the file from ~150 lines to ~70 and made adding new monitors trivial.

**Lesson:** When you find yourself copy-pasting a Terraform resource block more than twice, stop and reach for `for_each` with a locals map. The upfront investment pays back immediately.

---

## Observability: Five Starts and Counting

Logs, metrics and traces have been the most stop-and-start part of this platform. The history, from the GitOps repo:

- **Nov 2025: everything at once.** SigNoz (traces, metrics and logs on ClickHouse) and Pixie went in with the first commits.
- **Jan 2026: both archived.** Their cost was constant and my use of them was occasional ([ADR 016](../architecture/decisions/016-observability-approach/)).
- **Mar 2026: narrow tools.** Uptime Kuma for "is it up", Netdata for "how is this node".
- **Aug 2026: the alarms with nowhere to go.** A sweep found kube-worker-1 pegged at 100% CPU, with five components failing their readiness probes. My own cluster health job printed "OK: 71 apps and 199 pods healthy". Netdata had seen it: its CPU alarm was CRITICAL. But 2,269 alarms were armed across the fleet and **none could reach anybody**. The chart ships with Slack notifications switched on and an empty webhook. I wired it to my phone, critical only. Measured over a week, that came to about 4 a day against about 63 with warnings included, and 63 a day is the volume that had already buried 347 Falco criticals.
- **Sep 2026: the price of a dashboard.** Netdata's Kubernetes discovery was holding a cluster-wide watch on every Secret, from every node, confirmed in the API server's audit log. It was there for dashboard-only charts that no alarm used, so it went.
- **Oct 2026: Prometheus, back again.** This time to answer one specific question, whether services are meeting their objectives ([ADR 019](../architecture/decisions/019-metrics-and-slos/)).
- **Nov 2026: Netdata retired.** That was only after a parity week proved Prometheus caught everything it did. It didn't, at first: Netdata caught three out-of-memory kills that Prometheus had no rule for.

There is still no logs pipeline and no tracing.

Every restart came from a different question, and the tools that survived are the ones with a question attached. The ones I installed "to have observability" are gone. The August discovery is the part I'd tell anyone first: 2,269 alarms evaluating faithfully, and no way for any of them to reach a person.

**Lesson:** Start from the question, not the stack. And an alert you haven't watched arrive is a dashboard. Prove the delivery path before you count the alarm.

---

## One Host Down, Every Private Site Down

On 4 November one Proxmox host lost power for about nine hours, taking a control-plane node and a worker with it. Git, Argo CD and most apps carried on from the other worker. **Every private site was down anyway.**

The ingress gateway, the Cloudflare gateway and Istio's control plane each ran one replica, and all three happened to be on the dead worker. Their replacements sat Pending: the surviving worker was at 4,945 of 4,950 millicores of CPU *requested*. The other nodes are tainted, and with no priority set, a 100m gateway pod couldn't push anything else out of the way.

The fix: a PriorityClass so platform pods can preempt app pods, two replicas each, a disruption budget, and a topology spread that knows the tainted nodes aren't real options.

**Lesson:** High availability is a scheduling problem, not a replica count. Two replicas that can only land on one node, or a replacement with nowhere to go, are one replica.

---

## The Control That Failed Open

On 11 November Renovate automerged a minor Kyverno chart upgrade. The new version stopped executing the policy type all my rules were written in. The image-signature policy, set to Enforce, reported "policy is not enforced", and **unsigned images were admitted** — the exact thing [ADR 020](../architecture/decisions/020-signed-images-runtime-enforcement/) exists to stop. Nothing crashed and nothing went red: Kyverno was running, healthy, and not enforcing. It rolled back the same day, and Renovate now caps Kyverno below that version with automerge off, until the policies are migrated.

**Lesson:** A security control can fail open on a routine upgrade. Automerge is fine for things that fail loudly. For anything that enforces, test that it still refuses after every upgrade, not just that it's running.

---

## A Scanner That Always Finds Something

The nightly secret scan reported the same twenty findings every night. They were old leaks, all rotated back in September, but the allowlist had been left commented out "until rotated" and never uncommented. So the report was never empty, nothing paged, and **a new leak would have been finding number 21** in a weekly digest. One of the twenty hadn't been rotated: a deploy key for a tool I'd retired in January, sitting in the repository's second day of history. It was revoked the day this was found.

The fix allowlists each rotated leak by commit *and* file, so a new secret in the same file is still caught. I checked that with a planted token. Any finding at all now pages.

**Lesson:** A check that always reports something trains you to stop reading it. Get it to zero, then make anything above zero loud.

---

## Alerts That Could Never Fire

Writing an alert is easy. Knowing it can fire is a separate job, and this year turned up several that couldn't:

- **A disk-wear forecast** required 14 days of samples, on a Prometheus that keeps 7. It was unreachable from the day it was written.
- **An SLO showed exactly 100% availability** while 13 real errors happened. One wrong operator in a selector made the error query match nothing ([ADR 019](../architecture/decisions/019-metrics-and-slos/)).
- **The 2,269 Netdata alarms** above, evaluating correctly with nowhere to send.

None of them looked broken. A rule that can't fire is just as green as a healthy system.

**Lesson:** Test that an alert fires, not just that it parses. Break the thing on purpose, or backtest against a week you know contained a failure.

---

## Cold Starts Are Part of the Design

After a power cut on 1 November, the cluster was Ready about 23 minutes before the Synology was. The storage driver logs in to the NAS once, when it starts, and never retries. Every pod came up with no storage client, and every volume mount failed with "not found" until I restarted the driver pods by hand. The first restart was itself too early: the NAS refuses logins for about 30 seconds after its port opens.

An init container now waits for a working login, the driver's own, before the driver starts.

**Lesson:** Restart order across the whole lab, not just inside the cluster, is part of the design. Anything that connects once at startup will eventually start first.
