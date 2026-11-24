---
title: "ADR 020: Signed Images at Admission, Exec Allow-Lists in the Kernel"
eyebrow: Architecture Decision Record
summary: A purple-team exercise showed where detection stopped helping. The answer was two controls that say no instead of reporting afterwards — one at admission, one in the kernel.
permalink: /architecture/decisions/020-signed-images-runtime-enforcement/
card_title: "Signed images, and exec allow-lists in the kernel"
card_blurb: "A purple-team exercise showed where detection stopped helping. Kyverno now rejects unsigned in-house images, and Tetragon kills unexpected processes in nine workloads — rolled out log-only first."
layout: adr
status: Accepted
date_label: Oct 2026
subsystem: Security · Supply chain
builds_on: ["002", "013"]
tldr: Every in-house image is built by one shared pipeline that signs it and attaches an SBOM; Kyverno refuses unsigned ones at admission; Tetragon enforces per-workload exec allow-lists with SIGKILL — accepting a fail-open admission webhook, a self-managed signing key, and allow-lists that need a week of watching before they can enforce.
outcome_stats:
  - num: "1"
    label: Shared pipeline for every repo
  - num: "9"
    label: Workloads on SIGKILL enforcement
  - num: "23"
    label: Namespaces with "never here" rules
---

## Context

The platform's security tooling up to September 2026 was almost entirely **detection**: Falco watching syscalls, trivy-operator scanning images, Checkov and Gitleaks on the GitOps repos, kube-bench and Polaris for posture. All of it reports. None of it stops anything.

In early October I ran a **purple-team range** — a fenced namespace, a deliberately over-privileged pod, and then the Stratus Red Team attack techniques — to find out what that detection was actually worth. It was worth less than I thought:

- **An alert that fired never arrived.** "Terminal shell in container" triggered in Falco, and the notification gateway's severity floor silently dropped it.
- **Two rules I assumed were loaded weren't.** Falco's privileged-container and sensitive-mount rules weren't in the active ruleset.
- **Short-lived pods leave no scan.** trivy-operator scans periodically; a pod that lives a minute is never looked at.
- **API-only attacks are invisible.** The Kubernetes audit log isn't wired to Falco, so anything done purely through the API raises nothing.

The first two were fixed the same day. The rest pointed at one conclusion: for the things I can define in advance — *which images may run*, *which programs a workload may start* — I should stop asking a detector to notice and start refusing.

There was a second, more mundane problem. Every app repo carried its own copy of the CI pipeline. Two fix sweeps in one week each missed repositories, and one copied clone command had put a live token into 147 Falco events. You can't enforce anything about how images are built while every repository has its own idea of how.

## Decision

**One pipeline.** A shared `ci-actions` repository holds the build as reusable Gitea workflows and composite actions: checkout (with the token kept out of the command line and `.git/config`), Gitleaks over full history, image build, a Trivy scan that fails on fixable criticals, push, **sign**, and the GitOps tag bump. App repos call it instead of copying it, and Renovate keeps the pinned version current everywhere.

**Signed at build, verified at admission.**

- Every image the pipeline pushes is **signed with cosign** by digest, and gets a signed **CycloneDX SBOM** attached as an attestation.
- A **Kyverno** policy rejects any `gitea.private.gawarecki.us` image without a valid signature. It's in **Enforce**. A second policy requiring the SBOM attestation runs in **Audit** until it's quiet.
- The signing key is a key pair, not keyless: there's no public transparency log in this lab, so signatures don't go to one. The private key lives in Vault.

**Exec allow-lists in the kernel.** **Tetragon** runs alongside Falco, not instead of it, because it can act inside the kernel rather than report afterwards:

- **Per-workload allow-lists** for the twelve MCP servers, the apps that handle credentials or outside input (Authentik, Vault, Cortexa, big-recipes, Worth Keeping), and the Talos hosts themselves. A process not on the list is reported — or, once the list is trusted, **killed with SIGKILL before it runs**.
- **"Never here" rules** across 23 application namespaces: curl, wget, netcat, ssh, package managers, and compilers are flagged wherever they appear, matched on the exec path so BusyBox symlinks count too.
- Events go through the same notification gateway as every other alert ([ADR 019](../019-metrics-and-slos/)), prioritised by which kind of policy fired.

## Reasoning

- **Admission is the cheapest place to say no.** An unsigned image is refused before it has a pod, a network identity, or a chance to do anything. The proof was a planned exercise: an unsigned image was rejected and the signed build of the same code was admitted.
- **Signing only means something with one pipeline.** A signature says "this came through the pipeline." That's only worth checking if there is exactly one pipeline, and it scans before it signs.
- **Allow-lists beat block-lists for the workloads that matter.** I can't list everything an attacker might run. I can list what an MCP server legitimately runs, because it's short. The "never here" rules are the block-list half, kept for the namespaces where an allow-list isn't worth maintaining.
- **Log-only first, then enforce.** Each allow-list ran in report mode for a week before switching to SIGKILL, so the real behaviour wrote the list rather than my guess at it. Six workloads moved to enforcement on 18 October, three more on 25 October.

## Tradeoffs

- **The admission webhook fails open.** If Kyverno is down, images are admitted unverified. The alternative — a cluster that can't schedule its own repairs when the policy engine is unhealthy — is worse in a single-operator lab, but it is a real hole.
- **The scope is in-house images only.** Upstream images — Helm charts, vendor containers — aren't verified. The policy covers what I build, which is where I can guarantee a signature exists.
- **I hold the signing key.** Keyless signing would remove a long-lived secret; it needs public Fulcio and Rekor infrastructure this lab deliberately doesn't depend on. The key is in Vault, and its compromise would let someone sign anything.
- **Version friction.** cosign 3 had to run in legacy-format mode because Kyverno 1.19 can't read the newer bundle format — the kind of pin that breaks quietly on an upgrade.
- **Allow-lists need maintenance, and real software surprises you.** vLLM compiles GPU kernels with `gcc` at startup — about a hundred events per restart — and Paperless's init scripts call `dpkg`. Both needed exemptions, found only by watching. Most allow-lists, including nine of the twelve MCP servers, are still log-only.
- **One blind spot is structural.** A container's own entrypoint exec is never reported or killed, so a compromised image's first process is outside the allow-list's reach. Signing is what covers that case, which is part of why the two controls belong together.
- **Not every repo signs yet.** The pipeline signs by opt-in. The MCP gateways, Cortexa, Context Engine, big-ads and flaky do; a few newer repos don't yet, and the Enforce policy is what will make that hard to forget.

## Outcome

Since 8 October, an unsigned in-house image can't run on the cluster. Since 25 October, nine workloads — three MCP servers, Authentik's server and worker, Vault's injector, Cortexa, Worth Keeping, and big-recipes' public service — have a process allow-list the kernel enforces, and twenty-three namespaces report the tools that have no business being in them.

The exercise that started this is the part I'd keep. Running the attack myself found two broken alerts in an afternoon — alerts I'd have sworn worked. The purple-team range was torn down the same day; the habit of testing detection by triggering it wasn't.
