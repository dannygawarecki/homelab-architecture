---
title: big-recipes
eyebrow: Side Project · Accessibility
summary: The sibling to big-ads — accessible recipe search, reading, listening, and printing. Where big-ads could only magnify an image, this one owns the text, so typography and audio became design surfaces.
permalink: /projects/big-recipes/
---

<p class="pills-row">
  <span class="status status-live">Deployed in production</span>
  <span class="pill">v0.1.7 · built in a two-day sprint</span>
  <span class="pill">Source available on request</span>
</p>

[big-ads](../big-ads/) solved one problem for one person: weekly grocery flyers, unreadable on retailer sites. big-recipes is for the same person and the same impairment, but it is not the same project — and the spec is precise about why:

> **big-ads works with images, big-recipes works with text.** A flyer is a JPEG and all you can do is magnify it. A recipe is structured data, so typography, audio, and print layout are all fully under our control.

That single difference changes everything downstream. With a flyer, the ceiling is "make it bigger." With a recipe, you can set the type, read it aloud, step through it hands-free, and print it — but only if you can first get clean structured data out of a page that wasn't built to give it to you.

---

## Why recipe sites are their own kind of hostile

A modern recipe page is mostly not the recipe. It's an autoplaying video, a life story, three ad breaks, a newsletter modal, and a "jump to recipe" button that sometimes works. For someone running heavy screen magnification, that isn't an annoyance — it's a wall.

There's a second failure that's worse and less obvious. Search a dish and the results are dominated by **roundups**: "35 Easy Soup Recipes." A roundup is not a recipe. Clicking one and discovering that costs a sighted person two seconds; it costs this user a genuinely frustrating minute.

So the design goal was never "display recipes nicely." It was: **every result on the screen must be a real, readable recipe.**

---

## The hard part: getting a usable recipe out of a hostile page

The system searches a self-hosted **SearXNG** across three engines, takes roughly eighteen candidates, and runs each through a three-tier extractor:

1. **schema.org `Recipe` JSON-LD**, walked recursively including `@graph` containers. Fast and exact when it's there.
2. **`recipe-scrapers`** — around five hundred site-specific handlers.
3. **Headless Chromium**, for pages that don't serve structured data to a plain HTTP client.

Tier 3 is expensive, so it had to justify itself with a number. Across sixteen dish queries, tiers 1–2 filled every slot on **10 of 16** shortlists. All three tiers filled **16 of 16**. That's the entire argument for carrying a browser in the image.

### Extract before display

The decision I'd point at first: **extraction runs on candidates before the shortlist renders.** Anything that fails extraction is silently dropped and never appears as a card.

That inverts the normal cost model. Conventionally you show ten results fast and let the user discover which are duds. Here the user pays a few seconds up front, and in exchange the spec's requirement holds:

> He cannot click a dud.

Roundups get demoted before that, by matching URL shapes (`/gallery/`, `/g1234/`) and title patterns ("35 Easy Soup Recipes") — a rule written because the query *"easy soup recipe"* came back with twelve roundups and zero actual recipes.

---

## Making it fast enough to be usable

The first implementation fetched candidates in waves of six with `asyncio.gather`. Measured against the live cluster, that was bad: **19 of 54 candidates failed and burned 62 seconds**, with a single slow host sitting on its timeout for **25.4 seconds** alone. Every wave moved at the speed of its worst member.

The rewrite uses `asyncio.as_completed` with a semaphore, and three details matter more than the swap itself:

- **A post-acquire re-check**, so a candidate that reaches the front of the queue after five recipes have already survived bails instead of doing pointless work.
- **Cancellation-aware bookkeeping** — a fetch cancelled because the shortlist filled is deliberately *not* recorded as a failure for that host. Punishing a site for being late in a race it never needed to finish would poison the reputation data below.
- **A final re-sort back into ranking order**, because completion order is a race and the user should see the best result first, not the fastest one.

### Learning which hosts to trust

Every fetch updates a per-host success rate, beta-smoothed against a prior so one bad day doesn't condemn a site. Those rates bucket into three **deliberately coarse** tiers — coarse on purpose, so a marginally more reliable host can never outrank a far more relevant result.

Hosts that have **never once succeeded** after at least five attempts get skipped entirely, with a 30-day probation so a site that later grows a `Recipe` schema comes back on its own without intervention. The same table remembers which hosts need the browser tier, which previously had to be relearned on every restart.

`GET /api/hosts` exposes the whole table, on the principle that *a ranking which silently drops sites is one nobody can argue with*. The reputation module is pure policy — no database, no network — so the rules are unit-testable in isolation.

---

## Accessibility, in the code

Every constraint from [big-ads](../big-ads/) carries over, and the text medium adds more:

- **One root variable drives everything.** Sizing is `rem`-based off a single `--ui-pt`, so buttons, cards, and type scale together. Three user-selectable sizes (22/26/30px) persist in localStorage. The default moved up from 20px to 26px because 20 "made the controls smaller than they needed to be."
- **Buttons are `4.2rem` minimum height** — about 109px at the default size, comfortably past big-ads' 60px floor. Pure black on white, with 5px focus outlines.
- **Hotkeys are printed on the buttons they operate**, exactly as in big-ads — but here the badge is `aria-hidden` and the key is declared via `aria-keyshortcuts`, so a screen reader announces "SAVE" instead of reading a stray "S" into the label.
- **Cook mode** puts one instruction on screen at `3.4rem` in a `24ch` measure, and never auto-advances. Spacebar is aliased to right-arrow so an inexpensive USB presentation clicker or a foot pedal works with no extra code — which matters when your hands are covered in raw chicken. Entering cook mode explicitly blurs the activating button so spacebar doesn't re-trigger it.
- **Read-aloud highlights the line being spoken** and scrolls it to center.
- **Print is a separate design, not a screenshot.** Its own size scale (16/22/28px, independent of the screen setting), 14mm page margins, the photo hidden to save ink, and `page-break-inside: avoid` on ingredients and steps so a recipe never splits mid-list.

Same rules as before: no build step, no framework, no npm, no modals, no hover-only affordances.

---

## Deployment, and the one place L7 mattered

Delivery is the same [GitOps pipeline](../../architecture/diagrams/#gitops-delivery-flow) big-ads uses — gitleaks, pytest, build, registry push, manifest patch, ArgoCD reconcile — with a CI step that fails hard if the image-tag patch produces no diff.

The runtime posture is deliberately tight: a dedicated ServiceAccount with **no role bindings** and no mounted token, `readOnlyRootFilesystem`, non-root, all capabilities dropped, `seccompProfile: RuntimeDefault`, and Istio deny-all plus allow-ingress.

Egress is the interesting exception. Every other namespace on the platform gets either a no-internet lane or an FQDN allowlist ([ADR 008](../../architecture/decisions/008-cilium-cni/)). This one **can't** — a recipe search fetches arbitrary sites by definition, so the destination set is unknowable in advance. It gets a port-constrained lane instead: broad by necessity, and narrowed on the axis that's still available.

It's also the only service on the platform split across **two hostnames with different capabilities** — a public read-only surface and a private one that can write, export, and inspect. That split is enforced at the Istio VirtualService rather than in an AuthorizationPolicy, and the manifests are emphatic about why: the namespace is ambient, ztunnel is L4-only, and **no waypoint proxy is deployed** ([ADR 009](../../architecture/decisions/009-istio-ambient-mode/)). A policy carrying `paths` or `methods` would be accepted, look like a control, and enforce nothing.

That's the kind of failure worth designing against — not a control that breaks loudly, but one that silently isn't there.

---

## The decision to *not* use the better-sounding architecture

The original spec called for CloudNativePG and MinIO — the platform's standard, operator-managed, properly backed-up storage. It shipped instead on **SQLite with FTS5 and content-addressed gzipped blobs on a PVC.**

That looks like a downgrade, and I nearly built the impressive version. The measurement stopped it: the archive is meant to be *permanent*, and the platform's database and object-store retention is fourteen days. Porting would have moved a permanent archive from one bounded retention window to a slightly larger one, while adding two runtime dependencies to an application whose entire premise is working when the internet doesn't.

> The gap is a **retention policy** problem, not a storage-engine one.

Durability comes instead from a monthly export job that writes the archive to a never-expiring MinIO bucket — solving retention where retention actually lives, and leaving the app with one dependency instead of three.

---

## Engineering summary

<ul class="pills">
  <li>Python 3.11+</li><li>FastAPI</li><li>Playwright</li><li>BeautifulSoup4</li><li>SQLite + FTS5</li>
  <li>Vanilla JS</li><li>SearXNG</li><li>Kubernetes</li><li>ArgoCD</li><li>Gitea Actions</li>
</ul>

- ~1,700 LOC of Python across seven modules, ~1,000 of frontend in three files
- **125 tests** against that source — roughly 1:1 with implementation. No test touches the network or launches a browser; SearXNG and the extractor are stubbed and the browser tier is covered through a fake renderer
- One test asserts that `pyproject.toml`'s Python version, the Dockerfile base image, and the CI container image all agree — a class of drift that's invisible until it isn't
- **No AI anywhere in it.** Read-aloud is the browser's own speech synthesis. Self-hosted TTS on the GPU worker is a plausible next step, not a shipped feature

### Honest caveats

**This was a two-day build.** Thirty-one commits across two days, and little maintenance since. big-ads earned "in weekly use" through months of OOM fixes and feedback-driven commits; big-recipes hasn't earned that yet. It's deployed and it works — it is not battle-tested.

**Roughly half the spec isn't built.** Voice input, step timers, server-side PDF, direct printing, and self-hosted sentence-level audio are all designed and none are implemented. One endpoint exists that nothing calls.

**Errors use `alert()`.** The wording is plain-English and non-technical, but it's the one place the interface falls back on a browser default instead of a designed control.

---

## Why it's here

big-ads is the one that gets used every week. big-recipes is the one that shows what happens when the same constraints meet a medium that gives you room to work.

The engineering I'd defend in a review is all in the measurements: carrying a headless browser because 10-of-16 became 16-of-16, rewriting concurrency because 62 seconds were going into fetches nobody would ever see, refusing to punish a host for losing a race it didn't need to win, and turning down the more impressive storage architecture because it measured worse against the thing that actually mattered.

That last one is the habit I'd bring to a team: the fancier design was available, and the right call was still to leave it on the page.
