---
title: Everything Was Green
eyebrow: Writing
summary: A weekend that started with a self-signed certificate on a UPS and ended 164 commits later with seven applications that had never had a login. Almost nothing in between was broken. That was the problem.
permalink: /writing/everything-was-green/
---

Here is the line this whole weekend turned out to be about. It's from a commit message on Saturday morning:

> Assigning a custom role to the UniFi service account produced `login http=200` with certificate read **and** write both `403`; that job would have reported success every night until 2026-11-03 and then failed.

A login that succeeds. A service account that can do nothing it exists to do. And a nightly job, written specifically to catch that class of problem, reporting green for two months before failing on the one day it mattered.

I didn't set out to write about any of this. I set out to fix a certificate.

---

## The fast phase is real, and it works

The obvious version of this essay is a repentance narrative, and that version is wrong.

This lab exists *because* I went fast. It started in 2024 as Home Assistant and some ESP32s, and it got interesting exactly to the degree that I let one thing pull me into the next without stopping to write it down. The front page of this site already admits I get about eighty percent through each mini-project before something new drags me sideways. That's not a confession. That's the engine.

If I had insisted on a decision record for every choice in 2024, there'd be no lab to write records about.

So this isn't an argument for discipline. It's an argument about a specific failure mode the fast phase produces, which I had the wrong mental model for.

<div class="callout" markdown="0">
  <h3>The thesis</h3>
  <p>I assumed that moving fast leaves <em>broken</em> things behind — a backlog of red, waiting for me to get serious.</p>
  <p>It doesn't. It leaves things that work, and report healthy. Nearly everything I found across four days was passing its own check. The debt isn't visible as breakage, because the signal you'd use to find it is the signal that's lying.</p>
</div>

## It started with a certificate

Thursday evening, 17:05. A cert-manager Certificate for the UPS management card, because the thing was serving a self-signed cert and my browser complained every time I opened it.

The cluster's DNS-01 solver can already issue for any name in the domain. The gap was never *issuing* — it was **delivery** to things that aren't in Kubernetes. Three of them: a Tripp Lite UPS, a Synology NAS, and the UniFi console. Each needs a job that logs into a proprietary web API and uploads a PEM.

That's the entire scope as I understood it on Thursday.

## Automation creates the debt it was meant to remove

To log into three appliances you need three service accounts. So a project whose purpose was to retire three certificates that expire every 90 days **created three long-lived credentials that never expire.**

That's not a good trade, and it's the exact shape of the debt that had accumulated everywhere else in this lab.

So the credentials need rotating too. Which needs a runner. Which needs Terraform state somewhere a runner can reach, so state moved to MinIO. Which needs a Vault AppRole scoped to only the paths that runner touches.

**Which needs Vault to have a shape you can write a policy against.** And it didn't. Five separate `gitea` roots. Six for MinIO. Three for ArgoCD. Flat and ad hoc, each created the moment some app needed a secret and never revisited. You can't scope an AppRole to a layout like that without granting far more than you mean to — the policy would have been a wildcard, which defeats the point of having one.

So the entire secret store got reorganized, and every External Secret reference in the cluster rewritten to match.

Nothing in that chain was a detour. Each step was forced by the one above it. I never decided to reorganize Vault. I decided to fix a certificate, and reorganizing Vault was downstream of that at a distance of four steps.

## What the reorganization found

Moving a credential means finding everything that consumes it. Doing that forty-odd times over two days is, it turns out, an audit — just an unusually thorough one.

**An MCP server was running on a Vault root token.** `policies ["root"]`, `ttl 0`, no expiry, delivered into a namespace Secret through an ExternalSecret. One value that could read and write every secret in the store, rewrite policies, revoke any token, and seal the vault. It had been sitting there the whole time, working perfectly.

**A second service account held superuser** on Authentik, for a server that needed read access to about six endpoints.

**Four application secrets were committed to git.** Not in some private submodule — in the repo, in plaintext, doing their job.

**Two CI tools shared one token.** polaris and checkov authenticating as the same identity, which means neither could be rotated without silently breaking the other.

**And the rotation machinery could not have worked.** One commit that weekend reads “grant metadata write, without which no rotation can ever succeed.” KV v2 needs metadata write to update a secret; the policy only granted create. Every credential I'd written so far had been a create, so it had never come up.

**Vault had never had an audit device.** Not misconfigured — never enabled. Every request to the secret store since the day it was installed, unlogged.

Then Sunday added its own:

- **An identity-provider outpost, healthy, with zero providers.** Reporting version-matched for a year, gating nothing, handing browsers a URL on a closed port. It was healthy because it could reach Authentik over localhost; its health check was structurally incapable of noticing that the URL it gave browsers didn't answer.
- **My dashboard authenticating as the Terraform superuser.** Right Vault key, sixty well-formed characters, no log line anywhere. The tiles just showed zero. Authentik's event log was the only thing that named the cause: action=model_deleted.
- **An update-available alert that could never fire.** The version check needed version.goauthentik.io; the egress policy correctly denied the IdP any route to the internet. Two systems each doing exactly what they were told had combined into a monitor that could not alert.
- **A network policy with nothing to enforce against.** hubble-ui's AuthorizationPolicy looked identical to the six that worked. kube-system wasn't in the ambient mesh, so there was no mTLS principal to match on. It restricted nothing.
- **A liveness probe that had been passing wrong for a year.** It hit / and got a 200, but / was a 302 into an authenticated page, and the kubelet followed redirects. Under the old auth middleware that returned null and the chain ended 200. Change the middleware and the same path threw, the probe went 500, and the pod crashlooped. The probe didn't break. It had never worked.
- **And my own documentation was wrong.** [ADR 004](../../architecture/decisions/004-authentik-sso/) said, in my words, “Every web surface on the platform sits behind the same login.” Seven didn't. netdata was serving /api/v1/allmetrics for eight hosts to anyone who could resolve the name. Stirling PDF had SECURITY_ENABLELOGIN set to false, serving the whole toolkit — and whatever documents passed through it — to anyone at all.

Not one of those was reporting a problem. Several were actively reporting success.

## The one I got wrong

The best example of the weekend is the one where *I* was the thing reporting green.

I found a Gitea token carrying `write:package` and `write:repository` across every repository in the org, and went looking for its consumer. Checked the org's Actions secrets. Checked every Kubernetes Secret in the cluster. Found nothing. It had exactly one use in its entire history — `04:03:09` on Saturday — which I couldn't explain.

I wrote the negative result up carefully, flagged the unexplained use, and revoked the token on the grounds that an unattributable credential with that scope is worse than a broken consumer, because a broken consumer announces itself with a 401.

**It had a consumer.** The token was the per-repo `REGISTRY_TOKEN` in three repositories that lived under my *personal* namespace rather than the org's. My sweep enumerated `/orgs/gawarecki.us/repos` and never listed a personal repository, so three repos full of Actions secrets were outside the search from its first line. And that unexplained `04:03:09`? That was the consumer. Its own build log says `Login Succeeded at 04:03:08.9`.

I had the evidence in hand and drew the wrong conclusion, because the search space was wrong and nothing about a search space announces itself.

> **"Absent from every Actions secret" was really "absent from every ORG Actions secret", and the gap was invisible because a negative result looks identical whether the enumeration was complete or not.**

An empty result set isn't evidence of absence until you've proved the search covered the space — and mine looked exactly like one that had.

There was a second instance of the same bug in the same sweep, which I'd rather admit than bury: my scan for credentials in cluster Secrets missed registry credentials entirely, because that value sits inside a *second* base64 layer in the `auth` field of a `dockerconfigjson`. A clean scan. The wrong scan.

## The lesson, learned twice, thirty hours apart

The same idea got invented twice, independently, in two unrelated domains.

**Saturday morning — certificates.** The rotation jobs checked that their password file was non-empty, then exited. But renewals are ~60 days apart, so a revoked password or a narrowed role stays invisible until the one day rotation is due: the exact failure the job exists to prevent. The fix was to perform a **real login every night**, on the already-in-sync path, when nothing depends on the result. Prove the credential while it's still cheap to find out it's dead.

**Sunday afternoon — authorization policies.** Every app put behind the outpost got verified twice: request it from inside the outpost's own pod (expect 200), and request the same service from a pod in an unrelated namespace (**expect the connection to be reset**). The first test proves the app is up, which it was before I touched anything. The second is the only thing that distinguishes a working policy from hubble-ui's — both have a policy file, both look identical from outside, one resets the connection and one cheerfully returns 200.

Same idea. Two domains. Thirty hours apart.

**Prove the mechanism with a control, not the happy path.** A green check tells you something responded. A control tells you the thing you built is the *reason*. And the control has to fail at least once, deliberately, or you don't know it's wired to anything at all.

Nearly every item in the inventory above would have been caught in about thirty seconds by one negative test at the moment it was built. None of them ever got one — because at the moment they were built, everything was green.

## And then, on Sunday afternoon, "fix grocy's login"

Fifty-two hours into a weekend that began with a UPS certificate, the last thread started. It's worth tracing because it shows the same property at a smaller scale: not one of these steps was chosen.

<div class="timeline" markdown="0">
  <div class="tl-item">
    <div class="tl-date">Sunday 12:38</div>
    <div class="tl-title">Fix grocy's login</div>
    <p>grocy can't do OIDC. The one community plugin has no state parameter, no nonce, no PKCE and no id_token validation, and derives its redirect_uri from the current request. So: a reverse-proxy provider instead.</p>
  </div>
  <div class="tl-item">
    <div class="tl-date">12:43</div>
    <div class="tl-title">The apply fails on a name collision</div>
    <p>I gave the new proxy provider the same name as the OAuth2 provider it replaced. Authentik enforces name uniqueness <em>across provider types</em>, and nothing in the dependency graph ordered the destroy before the create — so they ran concurrently and left a half-applied mess.</p>
  </div>
  <div class="tl-item">
    <div class="tl-date">12:53</div>
    <div class="tl-title">grocy crashloops</div>
    <p>Changing the auth middleware turned that redirect-following probe from benign into fatal. I found a year-old bug by breaking it.</p>
  </div>
  <div class="tl-item">
    <div class="tl-date">12:58 – 13:37</div>
    <div class="tl-title">Login dies on the second hop</div>
    <p>Now that the outpost had a job, its configuration mattered for the first time — and that's where the unreachable NodePort surfaced. Setting the browser-facing host wasn't enough on its own: the rewrite is cached at process start, so it needed a rollout restart too.</p>
  </div>
  <div class="tl-item">
    <div class="tl-date">13:53</div>
    <div class="tl-title">Six more apps are obviously eligible</div>
    <p>Once the mechanism worked, the audit was unavoidable. kiali, hubble, netdata, dozzle, homepage, Stirling — none of them had any login at all.</p>
  </div>
  <div class="tl-item">
    <div class="tl-date">Same commit</div>
    <div class="tl-title">Seven network policies, and two that can't exist</div>
    <p>Header trust means the network policy is the real security boundary. Writing them surfaced that two namespaces aren't in the mesh, so two of the seven can't have one at all.</p>
  </div>
  <div class="tl-item">
    <div class="tl-date">14:12</div>
    <div class="tl-title">Check homepage's tiles — find the shared superuser token</div>
    <p>Which meant giving homepage its own service account, which meant a fourth Vault path split, for the same reason as gitea, proxmox and cloudflare before it: writing one key to a shared path deletes the others.</p>
  </div>
</div>

Two hours and thirteen commits, from "fix grocy's login." Which is about eight percent of the weekend.

The lesson there isn't "estimate better." It's that **in a system with real coupling, the size of a change is a property of the system, not of the request.** You can't scope it up front. You find out by pulling — and the honest thing is to keep pulling rather than stop at the first thing that makes the original symptom go away.

## The phase ended and I didn't notice

Here's the part I actually got wrong, and it isn't discipline.

Fast and loose is correct while the only person a silent failure can hurt is you. That was true for a long time. It stopped being true somewhere along the way, and there was no event marking it. My family uses Home Assistant and grocy every day. Documents go through that PDF tool. Nine applications hold OIDC client secrets in the same Vault that a root token was quietly reachable from.

Somewhere in there the lab acquired *consumers*, and the cost of a green check that means nothing went up by an order of magnitude.

**I didn't miss a best practice. I missed a threshold.**

I'm not going to stop going fast. What changes is narrower:

**Anything I stand up that is supposed to say no, I make say no once, on purpose, before I walk away from it.**

Everything else can stay loose. That one check is what makes the green mean something.

---

*164 hand-written commits across three repositories, Thursday evening to Sunday night. The decision record that came out of the last two hours of it: [ADR 017 — A reverse-proxy outpost for the apps that can't do OIDC](../../architecture/decisions/017-outpost-reverse-proxy-auth/). The correction it forced: [ADR 004](../../architecture/decisions/004-authentik-sso/).*
