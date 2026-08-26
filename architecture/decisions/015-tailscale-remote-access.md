---
title: "ADR 015: A Tailscale Subnet Router for Private Remote Access"
eyebrow: Architecture Decision Record
summary: A deliberate exception to "Git is the only way in" — remote access lives outside Kubernetes, because it has to work when the cluster doesn't.
permalink: /architecture/decisions/015-tailscale-remote-access/
---

**Status:** Accepted &nbsp;·&nbsp; **Date:** Aug 2026 &nbsp;·&nbsp; [← All ADRs](../../)

---

## Context

Until now the platform had exactly one way in from outside the house: a **Cloudflare Tunnel** fronting three deliberately public hostnames. That is the right tool for *publishing* things — it terminates at an Istio gateway, it's WAF-protected, and it exposes precisely what I chose to expose.

It is the wrong tool for *me* getting to the platform. Administering the lab remotely means reaching the Proxmox UIs, Vault, the Talos API, the Synology, the UniFi controller — none of which should ever be public, WAF or not. The options:

- **Expose more through the Cloudflare Tunnel** with Access policies in front. I tried this one first. Beyond never quite getting it to behave, it puts admin interfaces on the public internet behind an authorization layer, and every one of them becomes a thing I have to reason about being probed.
- **Port-forward a VPN (WireGuard/OpenVPN) on the router.** The traditional answer. It needs an open inbound port, dynamic-DNS handling, and per-device key distribution I'd maintain by hand.
- **Run Tailscale's Kubernetes operator** so the tailnet is just another workload. Consistent with how everything else runs — and, on reflection, exactly the wrong dependency (see below).
- **A Tailscale subnet router outside the cluster**, advertising the LAN into a private tailnet.

I really liked the thought of Tailscale and have read many articles on it by home-labbers just like me. It has a generous free tier that more than meets my needs — and it just worked, on the first try. I'd already spent an afternoon trying to get the same private access out of Cloudflare and never got it to do exactly what I wanted. Tailscale did, right out of the box.

## Decision

Run a **Tailscale subnet router in a dedicated Proxmox LXC** — not in Kubernetes — advertising `192.168.10.0/24` into a private tailnet. Everything about it is declared in Terraform: the container, the tailnet ACL policy, split DNS, and the bootstrap auth key.

**This is a deliberate exception to [ADR 001](../001-gitops-argocd/)'s "Git is the only way in."** The runbook says so explicitly: nothing in this path is managed by ArgoCD, and that is intentional.

The reason is dependency direction. Remote access is what I need *most* when the cluster is broken — and a tailnet that runs as a Kubernetes workload is unreachable in exactly the scenario it exists for. Putting it in an LXC that boots first (`startup order 1`) means the recovery path doesn't depend on the thing being recovered.

It is still infrastructure-as-code; it just answers to Terraform instead of ArgoCD.

## Reasoning

- **Admin interfaces stay off the public internet, entirely.** Not "behind auth" — unreachable. Proxmox, Vault, Talos, and the NAS are reachable only from inside the tailnet.
- **The ACL is code, and it has tests.** The whole tailnet policy lives in Terraform: tag ownership, route auto-approval scoped to `tag:infra`, and an `ssh` action of `check`. It also carries **policy tests** asserting that my identity can actually reach the Proxmox UI, Vault, and the LAN resolver — so a bad ACL edit fails at plan time instead of locking me out remotely.
- **Split DNS makes it transparent.** `private.gawarecki.us` resolves through the LAN resolver over the tailnet, so the same hostnames work at home and away. No separate "remote" bookmarks.
- **No open inbound ports.** Tailscale's NAT traversal means nothing is forwarded at the router, which removes an entire category of exposure.
- **It complements Cloudflare rather than replacing it.** Two ingress paths with two different jobs: Cloudflare publishes a small, deliberate public surface; the tailnet is the private administrative path. Neither is a fallback for the other.
- **Split tunneling, no exit node.** The tailnet routes lab traffic only. My general internet traffic doesn't route through the house — less latency, and the lab isn't load-bearing for browsing.

## Tradeoffs

- **It breaks the "everything is GitOps" story, and I'm naming that rather than hiding it.** There is now one path that ArgoCD doesn't own. I think the dependency argument justifies it, but it *is* a second system to remember — a reader is right to ask whether one exception becomes three.
- **A dependency on a third-party coordination service.** Tailscale's control plane is not mine. Devices hold keys locally so an outage doesn't instantly sever existing connections, but enrolling a new device does depend on someone else's service being up. That's the cost of not hand-rolling WireGuard.
- **A single subnet router is a single point of failure.** One LXC on one Proxmox host advertises the route. If that host is down, remote access is down — and it's a different host from the one I'd most likely be trying to fix. A second router advertising the same route is the obvious hardening step and isn't done yet.
- **Privileged host configuration.** The container needs `/dev/net/tun` passed through, which Proxmox API tokens can't configure — so that one resource authenticates as root rather than with a scoped token. A documented, deliberate weakening of the credential model in exactly one place.
- **The bootstrap key is written *into* Vault, not read from it.** Terraform mints the tailnet auth key and stores it; the usual direction on this platform is the reverse ([ADR 003](../003-vault-external-secrets/)). It works and it's auditable, but it's an inversion worth knowing about.

## Outcome

*Both ingress paths — the public Cloudflare tunnel and the private tailnet — are drawn in the [network layout diagram](../../diagrams/#network-layout).*

Remote administration now happens over the tailnet, and the public surface stayed exactly three hostnames. The recovery property is the one I care about most: because the router is an LXC that boots before anything else, "the cluster is broken and I'm not home" is now a solvable problem rather than a wait-until-I'm-back problem.


<div class="adr-nav">
  <a href="../014-vllm-inference/">&larr; ADR 014 &middot; vLLM for served generation</a>
  <a class="adr-nav-all" href="../../">ADR 15 of 16</a>
  <a href="../016-observability-approach/">ADR 016 &middot; Targeted observability &rarr;</a>
</div>
