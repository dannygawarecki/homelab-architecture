---
title: "ADR 017: A Reverse-Proxy Outpost for the Apps That Can't Do OIDC"
eyebrow: Architecture Decision Record
summary: Seven web surfaces had no usable login. Rather than wait for each vendor to ship OIDC, they moved behind Authentik's embedded outpost — which makes an L4 AuthorizationPolicy the actual security boundary.
permalink: /architecture/decisions/017-outpost-reverse-proxy-auth/
---

**Status:** Accepted &nbsp;·&nbsp; **Date:** Sep 2026 &nbsp;·&nbsp; [← All ADRs](../../)

---

## Context

[ADR 004](../004-authentik-sso/) established Authentik as the identity provider and a `for_each` map as the way to add SSO to an application. That pattern held — for applications that speak OIDC.

The gap was everything else. Seven web surfaces on this platform had no usable login:

- **kiali, hubble-ui, netdata, dozzle, homepage** — no authentication of any kind. Not misconfigured; they ship with none and expect to be gated by network position. netdata's `/api/v1/allmetrics` was answering to anyone who could resolve the name, for eight hosts.
- **Stirling PDF** — `SECURITY_ENABLELOGIN` set to `false`, serving the whole toolkit and whatever documents passed through it. Its manifest carries a commented-out `SECURITY_OAUTH2_*` block pointing at this Authentik, which is a false lead: Stirling moved SSO behind its paid tier.
- **grocy** — a local username/password login, and an Authentik OIDC application whose redirect URI pointed at `/api/auth/callback/custom`, a route grocy has never had. It was counted among the ten provider-application pairs in ADR 004 and it had never worked.

Every one of these sits behind the same gateway and the same certificate as the applications that *do* have SSO, which is exactly what makes the gap easy to miss.

Options:

- **Wait for upstream OIDC.** Not available on any useful timeline. Two of these projects have no OIDC in core, one sells it, and the rest have no user model to attach an identity to.
- **A community plugin, per app.** For grocy this meant `bboehmke/grocy-oauth`. Rejected on reading it: no `state`, no `nonce`, no PKCE, no `id_token` signature validation, and `redirect_uri` derived from the current request URI. It also targets the pre-4.x `Grocy\Middleware` namespace. This is a plugin that would have *looked* like SSO.
- **Accept network position as the control.** The status quo, and the audit above is what it was actually worth.
- **Authentik's embedded outpost as a forward-auth proxy.**

## Decision

**The embedded outpost fronts every web surface that cannot authenticate for itself.** Seven applications are generated from a `local.authentik_proxy_apps` map in Terraform, in the same shape as the OIDC map beside it — provider, application, and group policy binding, one entry each.

The applications split into two classes, and the distinction matters more than it looks:

- **Identity-forwarding** — grocy and dozzle read a username out of the request headers (`X-authentik-username` and friends) and run as that user. These get real identity.
- **Pure gate** — kiali, hubble-ui, homepage, netdata, and Stirling have no user model. The outpost is a locked front door and nothing more.

The deployment itself is one line per app: the embedded outpost is not a separate workload. It runs inside each `authentik-server` pod, is served off the same Service, and selects the provider by **Host header** — so routing a VirtualService at `authentik-server` (without rewriting authority) is the entire integration.

## Reasoning

- **It requires nothing of the application.** That is the whole point. It works identically for software with no auth, software whose vendor sells auth, and software whose auth is a decade behind.
- **No client secrets anywhere.** Seven applications gained SSO and the platform gained zero new credentials to store, deliver, or rotate. Stirling in particular holds nothing.
- **Group-based access still gates at the door,** the same admins/users split as the OIDC applications, bound per application.
- **One map entry per app**, matching the pattern ADR 004 established. Adding the seventh took about ten lines of diff, same as adding an OIDC client.

## Tradeoffs

These are real, and the first one is the one I'd raise in a design review:

- **Header trust moves the security boundary to the network policy.** grocy's `ReverseProxyAuthMiddleware` auto-creates any unknown username, and grocy's `DEFAULT_PERMISSIONS` is `['ADMIN']`. So anything that can reach `grocy:80` and set `X-authentik-username` is a grocy administrator. The Istio `AuthorizationPolicy` restricting that port to `cluster.local/ns/authentik/sa/authentik-server` is **not** defense in depth — it *is* the control, and it is doing the work people assume the login page is doing.
- **Two of the seven cannot have that control.** `kube-system` and `netdata` carry no `istio.io/dataplane-mode` label, so those hops have no mTLS identity and there is no principal for an AuthorizationPolicy to match. This is acceptable *only* because hubble-ui and netdata have no auth to forge into — the outpost closes the network-wide path through the gateway and leaves the in-cluster path exactly as open as it already was. For a header-trusting app it would be privilege escalation. Closing it means enrolling both namespaces in the ambient mesh, which is outstanding.
- **Ordering between the two repos is load-bearing.** Terraform must apply before the ArgoCD manifests are pushed. Reversed, the application stops accepting its own passwords while the outpost has no provider registered for its hostname, and the front door is simply shut.
- **Nothing without a browser session can get through.** A proxy in front of an application breaks mobile apps, webhooks, and long-lived API tokens — all of which meet a login redirect they cannot complete. This is precisely why Home Assistant is an OIDC client and not an outpost application: the companion apps, the webhooks, and the MCP integration's token would all have died. Every candidate now gets checked for machine consumers before it moves.
- **The single point of failure from ADR 004 gets sharper.** That ADR notes the break-glass path is broad because nearly every app has a local admin. These seven don't. If Authentik is down, grocy is not reachable by any path — there is no local login to fall back on, because the outpost never forwards the request.
- **Sign-out is partial.** Ending an Authentik session ends access; the applications' own notion of a session, where they have one, is not centrally revocable.

## Outcome

Sixteen applications now sit behind Authentik: nine OIDC clients and seven behind the outpost. The claim ADR 004 made in its Outcome — that every web surface sits behind the same login — is true as of this record, and was not when it was written.

The more durable result is the audit itself. Six of these seven had no authentication at all, on a platform whose documentation, dashboards, and monitors all reported that identity was solved. Nothing was broken; everything was green. **That story is written up separately: [Everything Was Green](../../../writing/everything-was-green/).**


<div class="adr-nav">
  <a href="../016-observability-approach/">&larr; ADR 016 &middot; Targeted observability</a>
  <a class="adr-nav-all" href="../../">ADR 17 of 17</a>
  <span></span>
</div>
