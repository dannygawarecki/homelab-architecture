---
title: Everything Was Green
eyebrow: Writing
summary: Going fast in a homelab doesn't leave broken things behind. It leaves things that work, and report healthy. A week of cleanup, and the seven green checks that were lying.
permalink: /writing/everything-was-green/
---

Somewhere in my Terraform there was a line that had been wrong for about a year:

```hcl
grocy = {
  group         = "users"
  redirect_uris = ["https://grocy.private.gawarecki.us/api/auth/callback/custom"]
}
```

That is an OIDC redirect URI pointing at a route grocy has never had. Not a typo — a whole callback path belonging to a piece of software grocy isn't. There was a matching provider in Authentik, a matching application in the catalog, a tile in the app launcher, and a line in [my own ADR](../../architecture/decisions/004-authentik-sso/) counting it among the ten applications with single sign-on.

Nobody could ever have logged in through it. And nothing, anywhere, said so.

---

## The fast phase is real, and it works

I want to be careful here, because the obvious version of this essay is a repentance narrative, and that version is wrong.

This lab exists *because* I went fast. It started in 2024 as Home Assistant and some ESP32s, and it got interesting exactly to the degree that I let one thing pull me into the next without stopping to write it down. The front page of this site already admits I get about eighty percent through each mini-project before something new drags me sideways. That is not a confession. That is the engine.

If I had insisted on an architecture decision record for every choice in 2024, there would be no lab to write records about.

So this isn't an argument for discipline. It's an argument about a specific failure mode the fast phase produces, which I had entirely the wrong mental model for.

<div class="callout" markdown="0">
  <h3>The thesis</h3>
  <p>I assumed that moving fast leaves <em>broken</em> things behind — a backlog of red, waiting to be cleaned up when I got serious.</p>
  <p>It doesn't. It leaves things that work, and report healthy. Every single problem I found in a week of cleanup was passing its own health check. The debt isn't visible as breakage, because the signal you would use to find it is the signal that's lying.</p>
</div>

## Seven green checks

Here is the actual inventory from one week, and what each thing was reporting about itself at the time.

**The outpost was healthy and had zero providers.** Authentik's embedded outpost had been installed since day one, reporting healthy, version-matched, no warnings. It had no providers registered — it was gating nothing — and its `authentik_host` was a NodePort on port 30443 that resolves to the gateway load balancer, where 30443 is closed. `curl` gets status `000` and there is no certificate to present.

It reported healthy for a year *because* of how it's built. An embedded outpost runs inside the `authentik-server` pod and reaches Authentik core over localhost; its own API calls log as `host=localhost, remote=::1`. Its health check was structurally incapable of noticing that the URL it hands to browsers was unreachable. It was accurately answering a question nobody was asking.

**My dashboard was authenticating as the Terraform superuser.** Three tiles on my homepage dashboard read from Authentik's API. The token they used was in Vault, under the right key, sixty well-formed characters. It was the auto-generated token belonging to Authentik's `terraform` service account — an Authentik superuser, shared with my Terraform state. Rotating Terraform's own credential revoked it.

The tiles showed zero. Homepage logged nothing at all — not a warning, not a 403, nothing. The Vault key was present and populated. The value was a perfectly well-formed dead credential. The only thing on the entire platform that named the cause was Authentik's own event log, filtered to `action=model_deleted`, which listed the token and the timestamp it was destroyed.

**An alerting rule that could not fire.** Authentik reports `version_latest: 0.0.0` and `version_latest_valid: false`. I had a notification rule wired up for "update available." It can never fire, because the version check needs to reach `version.goauthentik.io` and my Cilium egress policy — correctly — denies the identity provider any route to the internet.

Two systems, each doing exactly what it was configured to do, combining into a monitor that is structurally incapable of alerting. Nothing is misconfigured. The alert just never comes.

**ArgoCD said `Synced`.** It means synced to the last revision it fetched, not current with `main`. I read it as the latter for longer than I'd like.

**A network policy enforcing nothing.** hubble-ui has an `AuthorizationPolicy` that looks exactly like the six that work. It restricts nothing at all, because `kube-system` isn't enrolled in the ambient mesh, so there is no mTLS principal for the policy to match on. From outside, it is indistinguishable from a policy that works.

**A probe that had been passing wrong for a year.** grocy's liveness probe hit `/` and got a 200. But `/` is a 302 to `/stockoverview`, and the kubelet's HTTP prober follows redirects — so the probe had actually been landing on an authenticated page the whole time. Under grocy's default auth middleware that returned `null` and the chain ended 200. The moment I switched the middleware to reverse-proxy auth, the same code path started throwing, the probe went 500, and liveness restarted the pod in a loop.

The probe didn't break. It had never worked. It had been failing in a direction that looked like success.

**And the documentation.** ADR 004's Outcome section said, in my own words: *"Every web surface on the platform sits behind the same login."* Six of the seven applications I gated that week had no authentication of any kind. netdata was serving `/api/v1/allmetrics` for eight hosts to anyone who could resolve the name. Stirling PDF had `SECURITY_ENABLELOGIN` set to `false`, serving the whole toolkit — and whatever documents passed through it — to anyone at all.

I wrote that sentence in good faith. It drifted from reality, and there is no mechanism anywhere in my stack that checks prose against the cluster.

## How one ask became all of that

The week started as a single request: **fix grocy's login.** It's worth writing out what actually happened, because it wasn't scope creep. Every step was *caused* by the previous one.

<div class="timeline" markdown="0">
  <div class="tl-item">
    <div class="tl-date">The ask</div>
    <div class="tl-title">Fix grocy's login</div>
    <p>grocy can't do OIDC. The only community plugin has no state parameter, no nonce, no PKCE and no id_token validation, and derives its redirect_uri from the current request. So: a reverse-proxy provider instead.</p>
  </div>
  <div class="tl-item">
    <div class="tl-date">Immediately</div>
    <div class="tl-title">The apply fails on a name collision</div>
    <p>I gave the new proxy provider the same name as the OAuth2 provider it replaced. Authentik enforces name uniqueness <em>across provider types</em>, and nothing in the dependency graph ordered the destroy before the create — so they ran concurrently and left a half-applied mess.</p>
  </div>
  <div class="tl-item">
    <div class="tl-date">Then</div>
    <div class="tl-title">grocy crashloops</div>
    <p>Changing the auth middleware turned that redirect-following probe from benign into fatal. I found a year-old bug by breaking it.</p>
  </div>
  <div class="tl-item">
    <div class="tl-date">Then</div>
    <div class="tl-title">Login dies on the second hop</div>
    <p>Now that the outpost had a job, its configuration mattered for the first time — and that is where the unreachable NodePort surfaced. Setting the browser-facing host wasn't enough on its own: the rewrite is cached at process start, so it needed a rollout restart too.</p>
  </div>
  <div class="tl-item">
    <div class="tl-date">Then</div>
    <div class="tl-title">Six more apps are obviously eligible</div>
    <p>Once the mechanism worked, the audit was unavoidable. kiali, hubble, netdata, dozzle, homepage, Stirling — none of them had any login at all.</p>
  </div>
  <div class="tl-item">
    <div class="tl-date">Then</div>
    <div class="tl-title">Seven network policies, and two that can't exist</div>
    <p>Header trust means the network policy is the real boundary. Writing them surfaced that two namespaces aren't in the mesh, so two of the seven can't have one.</p>
  </div>
  <div class="tl-item">
    <div class="tl-date">Then</div>
    <div class="tl-title">Check homepage's tiles — and find the shared superuser token</div>
    <p>Which meant giving homepage its own service account, which meant a fourth Vault path split, for the same reason as gitea, proxmox and cloudflare before it: writing one key to a shared path deletes the others.</p>
  </div>
</div>

Thirteen commits across two repositories, from "fix grocy's login."

The lesson I'd take from that isn't "estimate better." It's that **in a system with real coupling, the size of a change is a property of the system, not of the request.** You can't scope it up front. You find out by pulling — and the honest thing is to keep pulling, rather than stop at the first thing that makes the original symptom go away.

## What actually works: test the negative

If the green check is the thing that lies, the fix isn't a better dashboard. It's a different question.

Every one of the seven applications got the same verification, run twice:

- From inside the Authentik outpost's own pod, request the service. **Expect 200.**
- From a pod in a completely unrelated namespace, request the same service. **Expect the connection to be reset.**

The first test is the one everybody runs, and it proves almost nothing — it proves the application is up, which it was before I touched anything. The second is the only thing that distinguishes kiali from hubble-ui. Both have a policy file. Both look identical from outside. One resets the connection and one cheerfully returns 200, and you cannot tell which by reading the YAML or by looking at any dashboard I own.

That's the whole discipline, and it's cheap: **prove the mechanism with a control, not with the happy path.** A green check tells you something responded. A control tells you the thing you built is the reason.

The corollary is that the check has to *fail* once, deliberately, or you don't know it's connected to anything. The version-check alert, the hubble policy, the grocy probe, the outpost's health status — all four would have been caught in about thirty seconds by a single negative test at the moment they were built. None of them ever got one, because at the moment they were built, everything was green.

## The phase ended and I didn't notice

Here's the part I actually got wrong, and it isn't discipline.

Fast and loose is correct while the only person a silent failure can hurt is you. That was true for a long time. It stopped being true somewhere along the way, and there was no event marking it: my family uses Home Assistant and grocy every day. Documents go through that PDF tool. Nine other applications hold OIDC client secrets in the same Vault, on the same rotation clock. Somewhere in there the lab acquired *consumers*, and the cost of a green check that means nothing went up by an order of magnitude.

I didn't miss a best practice. I missed a threshold.

So I'm not going to stop going fast — that trades away the thing that built this for a discipline I'd abandon by December anyway. What changes is narrower, and I think it's the only part of this that generalizes: **anything I stand up that is supposed to say no, I make say no once, on purpose, before I walk away from it.**

Everything else can stay loose. That one check is what makes the green mean anything.

---

*The decision this week produced: [ADR 017 — A reverse-proxy outpost for the apps that can't do OIDC](../../architecture/decisions/017-outpost-reverse-proxy-auth/). The correction it forced: [ADR 004](../../architecture/decisions/004-authentik-sso/).*
