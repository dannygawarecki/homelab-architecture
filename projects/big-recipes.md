---
title: big-recipes
eyebrow: Side Project · Accessibility
summary: The sibling to big-ads — a browser extension that turns the recipe he already found into large type, read-aloud, cook mode, and print. It started as a search engine. The search engine was the part that had to go.
permalink: /projects/big-recipes/
---

<p class="pills-row">
  <span class="status status-live">Deployed in production</span>
  <span class="pill">Extension 3.0 · service 0.1.64</span>
  <span class="pill">Source available on request</span>
</p>

[big-ads](../big-ads/) solved one problem for one person: weekly grocery flyers, unreadable on retailer sites. big-recipes is for the same person and the same impairment, but it is not the same project — and the spec is precise about why:

> **big-ads works with images, big-recipes works with text.** A flyer is a JPEG and all you can do is magnify it. A recipe is structured data, so typography, audio, and print layout are all fully under our control.

That single difference changes everything downstream. With a flyer, the ceiling is "make it bigger." With a recipe, you can set the type, read it aloud, step through it hands-free, and print it — but only if you can first get clean structured data out of a page that wasn't built to give it to you.

---

## Why recipe sites are their own kind of hostile

A modern recipe page is mostly not the recipe. It's an autoplaying video, a life story, three ad breaks, a newsletter modal, and a "jump to recipe" button that sometimes works. For someone running heavy screen magnification, that isn't an annoyance — it's a wall.

So the design goal was never "display recipes nicely." It was: **whatever he's looking at, turn it into a real, readable recipe — or say plainly that it can't.**

---

## Version one: a search engine, and why it went

The first big-recipes, built in September 2026, was a search engine. It queried a self-hosted SearXNG across three engines, ran every candidate through a three-tier extractor — schema.org JSON-LD, the `recipe-scrapers` library, and a headless Chromium for pages that hid their data — and only showed results that extracted cleanly, so he could never click a dud. It learned which hosts to trust, demoted "35 Easy Soup Recipes" roundups, and stored a permanent archive in SQLite. I was proud of the measurements behind it: the browser tier earned its place by taking full shortlists from 10 of 16 queries to 16 of 16.

Then he used it. The feedback, recorded in the commit that started the change:

> The feedback on search was that it is fine and Google and Bing are better.

He'd find a recipe in the search engine he already uses, then try to find it again in mine. No amount of ranking work closes that gap, so the app stopped competing. Search went first. Then, on 1 October, the whole Python application went with it — search, the host-reputation tables, the headless browser, the database, and the archive job — replaced by an extension and a service that keeps nothing.

That's the decision on this page I'd defend first: the most interesting engineering in version one was solving a problem the user didn't have.

---

## Now: the button on the page he's already on

big-recipes is now a **Chrome and Edge extension** (Manifest V3). He finds a recipe however he likes, then asks for it big: the toolbar button, **Alt+R**, right-clicking the page, or right-clicking a link — search-engine redirect wrappers from Google, Bing, and DuckDuckGo are unwrapped, and Pinterest pins are followed through to the real recipe.

The reader, cook mode, his recipe box, settings, and print are all extension pages, opened **in the same tab**, so Back behaves the way he expects rather than skipping past the page he came from.

### Getting the recipe out

1. **JSON-LD first, in the browser.** The extension reads the page's schema.org `Recipe` data itself and sends just that to the service.
2. **Stripped HTML when that falls short.** If the data is missing or incomplete, the service answers `422 need: html` and the extension sends the page's HTML, stripped of scripts and styling and gzipped.
3. **`recipe-scrapers` on the server**, with about seven hundred site-specific handlers, runs in a separate extractor container.

The stripping had to be proven harmless before it shipped: run against the library's own 1,083 test pages, **1,075 extracted identically** from the stripped HTML. Requests are capped at 1 MiB on the wire and 4 MiB inflated, and results are keyed by a hash of the URL with tracking parameters removed.

There is no headless browser any more. The extension already *is* a browser, looking at the page as it actually rendered for him.

### The service keeps nothing

The project's README puts it in two sentences:

> There is no search, no sign-in and no database. Search was dropped on purpose.

His recipe box lives in the extension's own storage on his computer. Recipes he opens are kept for two days, recipes he saves are kept for good, and **SAVE A COPY / BRING IN A COPY** writes and reads a plain JSON backup.

Getting there involved building the other version first. A design with Firestore, OIDC sign-in, households, and device pairing was built and run in a staging environment, then abandoned. A lighter version with signed setup links was dropped a day later, for a reason I'd put in front of any architecture review:

> A token protected only some computing time, at the cost of a setup link per browser… and a call to set him up.

The staging environment and its identity client are gone too.

---

## Accessibility, in the code

Every constraint from [big-ads](../big-ads/) carries over, and the text medium adds more:

- **One root variable drives everything.** Sizing is `rem`-based off a single root size, so buttons, cards, and type scale together. Three user-selectable sizes (22/26/30px), defaulting to 26. Buttons are at least `2.6rem` — about 68px at the default, past big-ads' 60px floor.
- **A dark theme** ("Light on dark") alongside the default, plus a reading-speed setting for read-aloud. Focus is a double ring in the key color, not a browser default. Type is **Atkinson Hyperlegible Next**, bundled with the extension rather than fetched.
- **Hotkeys are printed on the buttons they operate**, exactly as in big-ads — but here the badge is `aria-hidden` and the key is declared via `aria-keyshortcuts`, so a screen reader announces "SAVE" instead of reading a stray "S" into the label.
- **Cook mode** puts one instruction on screen at `3.4rem` in a `26ch` measure, and never auto-advances. Spacebar is aliased to right-arrow so an inexpensive presentation clicker or a foot pedal works with no extra code. **T** starts a step timer; running timers stay pinned on every page, and **X** or **Esc** answers one that's ringing.
- **Half / As written / Double** scales the ingredients.
- **Read-aloud highlights the line being spoken** and scrolls it to center. It's the browser's own speech synthesis — no AI, no server.
- **Print is a separate design, not a screenshot.** Its own size scale (16/22/28px, independent of the screen setting), 14mm page margins, the photo hidden to save ink, and steps and ingredients that never split mid-list.
- **Errors are pages, not pop-ups.** One sentence in large type and a GO BACK button.

The visual redesign started from Google Stitch mockups and was then amended by hand against these rules.

---

## Deployment, and who is allowed to ask

Delivery is the platform's [GitOps pipeline](../../architecture/diagrams/#gitops-delivery-flow), through its shared CI workflows: tests, secret scan, image build and scan, registry push, manifest patch, ArgoCD reconcile. Pull requests are built and scanned before they can merge. The extension itself is distributed as an **unlisted Chrome Web Store** listing, which Edge installs from too.

The service is a small **Go** program; the extractor is a separate Python container that only the service may call. Both run as non-root on read-only filesystems with every capability dropped, under the namespace's `restricted` Pod Security level — possible now that there's no Chromium to accommodate — and behind Istio deny-all.

**Egress is zero.** Version one needed a broad, port-constrained internet lane because a search fetches arbitrary sites by definition. Today's version never fetches anything — the extension brings the page with it — so the namespace moved to the platform's no-internet lane ([ADR 008](../../architecture/decisions/008-cilium-cni/)). Deleting a feature closed the platform's only open-ended egress lane.

What's left to control is **who may call it**, and that's enforced in three places:

- **At Cloudflare**, two firewall rules: only `GET`/`HEAD` on the landing and privacy pages and `POST` on `/api/captures` are allowed at all, and `/api/captures` is refused unless the `Origin` is this extension's ID. A zone-wide rate limit sits on top.
- **In the service**, the same origin check, so the rule doesn't depend on the edge alone.
- **In the extension**, whose ID is pinned by a key in its manifest, so the origin can't drift between builds.

There are still two hostnames — the public one, and a private one that serves everything for testing from home — and the split is enforced at the Istio VirtualService rather than in an AuthorizationPolicy. The manifests are emphatic about why: the namespace is ambient, ztunnel is L4-only, and **no waypoint proxy is deployed** ([ADR 009](../../architecture/decisions/009-istio-ambient-mode/)). A policy carrying `paths` or `methods` would be accepted, look like a control, and enforce nothing.

That's the kind of failure worth designing against — not a control that breaks loudly, but one that silently isn't there.

---

## Engineering summary

<ul class="pills">
  <li>Go</li><li>Python 3.14</li><li>recipe-scrapers</li><li>Chrome MV3 extension</li><li>Vanilla JS</li>
  <li>Atkinson Hyperlegible Next</li><li>Kubernetes</li><li>ArgoCD</li><li>Gitea Actions</li><li>Cloudflare</li>
</ul>

- **Service:** about 1,000 lines of Go across eight files, plus ~470 lines of tests
- **Extension:** about 1,950 lines of JavaScript, 390 of CSS, and 110 of HTML
- **Extractor:** a 122-line handler around `recipe-scrapers`
- **About 60 test functions** — 14 in Go, 42 for the extension, 5 for the extractor
- **No AI anywhere in it.** Read-aloud is the browser's own speech synthesis.
- **Built to move.** The service and extractor already speak Cloud Run's conventions — its `PORT`, ID tokens between the two, an optional edge secret so the public rules can't be skipped by calling the service directly. They run only in the cluster today; Cloud Run is a "later", not a plan with a date.

### Honest caveats

**It's an unlisted extension for Chromium browsers.** Chrome and Edge only, and it asks for broad host access — because a permission scoped to the active tab ends the moment the tab navigates to another site, which is exactly what the right-click-a-link path does.

**Each browser has its own recipe box.** There's no sync, by design — no accounts — so moving to a new computer means saving a copy and bringing it in by hand.

**Some of the spec is still unbuilt.** Voice input, server-side PDF, and self-hosted sentence-level audio are designed and not implemented. Step timers and ingredient scaling, missing from version one, now exist.

**It still reaches into the lab.** Unlike big-ads, it can't be static files — it has to run extraction — so public requests still arrive through the Cloudflare Tunnel. The edge rules make that path narrow, but it's a path.

**It hasn't earned "in weekly use."** He has used it — the decision to drop search came from his feedback — but big-ads earned that label through months of fixes driven by real use, and big-recipes hasn't had those months yet.

---

## Why it's here

big-ads is the one that gets used every week. big-recipes is the one that shows what happens when the same constraints meet a medium that gives you room to work — and what happens when a measurement you're proud of turns out to be measuring the wrong thing.

Version one had the better engineering story: a headless browser justified by 10-of-16 becoming 16-of-16, concurrency rewritten because 62 seconds were going into fetches nobody would see, a reputation system careful not to punish a host for losing a race. All of it was real, and all of it is deleted. The user already had a search engine he trusted. What he didn't have was a way to read what it found.

That's the habit I'd bring to a team: build the impressive thing if you have to, measure it against the person it's for, and delete it when it loses.
