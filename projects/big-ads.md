---
title: big-ads
eyebrow: Side Project · Accessibility
summary: A grocery flyer viewer built for one person with severe visual impairment — where every interesting engineering decision was forced by an accessibility constraint.
permalink: /projects/big-ads/
---

<p class="pills-row">
  <span class="status status-live">Running in production · in daily use</span>
  <span class="pill">Source available on request</span>
</p>

<p class="pills-row">
  <a class="btn btn-primary" href="https://big-ads.gawarecki.us/">Open big-ads &nearr;</a>
</p>

The name means making store ads *physically big*. It has nothing to do with advertising technology. It later gained a sibling, [big-recipes](../big-recipes/), built for the same person against the same constraints.

big-ads exists because grocery store websites are effectively unusable for someone with severe visual impairment. Weekly flyers are rendered into `<canvas>` elements inside nested cross-origin iframes, gated behind store-locator forms and cookie modals, with controls too small to hit and layouts that collapse under screen magnification. Every one of those is a deliberate product decision by the retailer, and collectively they lock out the people most likely to be price-sensitive about groceries.

So the system scrapes four regional chains on a schedule, normalizes their flyers into high-resolution page images, and serves them through an interface built for exactly one person.

The success criteria in the spec end with the real one:

> Never interact directly with grocery store websites.
>
> If all six are true, the project has achieved its purpose.

---

## Designing for a constraint, not a persona

The spec's **non-goals** section is the part I'd point at. No accounts. No search. No mobile-first. "Beautiful UI" is listed explicitly as a non-goal.

> The system prioritizes reliability and simplicity over features and aesthetics.

The interface is four giant stacked store buttons, then a fit-to-width flyer page with HOME / PREVIOUS / NEXT. That was the entire product surface at launch, and it's still the spine. Added since: ZOOM (1×/2×/3× with drag-to-pan), a DARK SCREEN high-contrast toggle, RELOAD, a page-progress bar, a "MAY BE OUT OF DATE" tag when a store's capture is stale, and a NEXT STORE offer at the end of each flyer. Every page has its own URL, so a reload or a bookmark returns to the same page.

The requirements are measurable rather than aspirational:

- Minimum button height **60px**
- Page load **under 2 seconds over 12 Mbit DSL**
- No hover dependencies, no hamburger menus, no nested navigation, no modal workflows

Every interactive control has a single-letter hotkey — and the letter is **printed visibly on the button**. Hidden keyboard shortcuts are useless to a user who can't be expected to memorize them.

The frontend is **about 1,500 lines of vanilla HTML, CSS, and JavaScript with no dependencies and no build step.** It launched at 347; the growth is the features above, not a framework. That's not minimalism for its own sake. A build pipeline is a thing that can break between me and someone who depends on this working every week.

---

## The hard part: four stores, four incompatible defenses

Each retailer publishes flyers in a way that resists automation differently, so each needed its own approach behind a shared `fetch_latest() -> FlyerPackage` interface.

### Flipp (Aldi, IGA) — a three-tier fallback chain, and then the stores left

The hardest piece, and the one I was happiest with. The flyer renders to a canvas inside a nested cross-origin iframe. The capture script dismisses the cookie banner, finds the postal-code frame, types a ZIP, matches a store button by `aria-label`, and locates the publication frame. Then it degrades gracefully:

1. **Sniff the API response for a `pdf_url`** and download the true source PDF — complete, perfect pages.
2. If unavailable, **passively record the CDN tile requests** the viewer makes, re-fetch every tile, and **stitch them back into full pages** — missing tiles filled white rather than failing the whole capture.
3. Last resort: **scroll and screenshot** each canvas element.

Captures are validated before publishing, and top UI chrome is auto-trimmed by pixel scanning.

The fallback chain mattered because tier 1 breaks silently whenever the vendor changes their API — and when it does, the system degrades to slightly worse images instead of going dark on the person using it.

What it couldn't survive was the retailers leaving the vendor. **ALDI moved off Flipp in August 2026** to an Instacart storefront; its new adapter uses a browser only to discover a CDN prefix, then downloads the pages over plain HTTP. **IGA left in September** and now publishes a print-ad PDF, which is downloaded directly — no browser at all. No store in the config uses Flipp today. The adapter interface is what made that a two-adapter change instead of a rewrite: `fetch_latest() -> FlyerPackage` didn't care where the pages came from.

### Kroger — resolving a human address to an internal ID

There is no public API mapping an address to a store. So it downloads Kroger's **public store-locator sitemap** and token-scores store URLs against the address, then pulls pages from an undocumented internal circular endpoint, filtering for the weekly print ad.

### Save-A-Lot — recovering server state from the HTML

Flyer data is embedded in a server-rendered Remix context blob (`window.__remixContext`), so it's parsed back out of the page, with a sitemap-plus-API fallback to turn a slug URL into a numeric store ID.

---

## Making it reliable

Scraping four hostile sites on a schedule fails constantly. The engineering is mostly about failing safely.

**Per-store failure isolation.** The orchestrator wraps each store in its own timeout and catches its own failures. Aldi breaking doesn't stop Kroger from refreshing.

**Atomic publish.** Pages are written to a working directory, then `current` is renamed to `_previous` and the work directory renamed into place. A reader can never see a half-written flyer — the swap is a rename, not a copy.

**A single-flight lock.** Concurrent refresh requests return HTTP 409 rather than racing.

**No database.** Storage is a flat filesystem tree of page images plus a metadata file. Given a small, fully-derived dataset that can be rebuilt by re-running the pipeline, a database would have been a stateful service to back up and operate for no benefit.

The processing pipeline rasterizes PDFs at 300 DPI, autocrops white margins by luminance threshold, downscales with LANCZOS, and encodes progressive JPEG at quality 92 — tuned so pages render sharp under heavy magnification while still hitting the 2-second budget on DSL.

An out-of-memory incident in production is what drove the per-store timeouts and made DPI, width, and quality environment-tunable. That fix is in the commit history, which reads like software someone actually uses: *"Fix for OOM," "Hopefully final fixes for Kroger," "Fixes based on feedback."*

---

## Deployment — the lab builds it, the edge serves it

The application is fully GitOps-delivered with no manual steps — the whole path is drawn in the [GitOps delivery flow diagram](../../architecture/diagrams/#gitops-delivery-flow):

1. Push to **Gitea**, self-hosted in the cluster. Pull requests are built and scanned before they can merge.
2. **Gitea Actions** — through the platform's shared CI workflows — tests, secret-scans, bumps the version, builds and scans the image, and pushes it to the private in-cluster registry.
3. The pipeline then **clones the GitOps repo and patches the image tag** in the deployment manifest.
4. **ArgoCD** reconciles and rolls it out.

The CI runner is executing *inside the cluster it deploys to*, cloning over in-cluster service DNS. Separately, editing `stores.yaml` in the app repo automatically regenerates the corresponding Kubernetes ConfigMap in the GitOps repo — config-as-code across two repositories.

### Nothing public reaches the lab

Until September 2026 the public site was served from that pod, through a Cloudflare Tunnel into the cluster. It isn't any more. big-ads has no users to authenticate and nothing to write, so its public copy can be plain files — and plain files don't need to come from my house.

Each refresh now builds a **static site** and uploads it to a **Cloudflare R2 bucket**: page images first, then the JSON, then `index.html` last, so a reader never sees a page that points at images that aren't there yet. Pages live under per-publish version paths cached as immutable, and superseded versions are deleted after a day's grace. `big-ads.gawarecki.us` is the bucket's custom domain, with one rewrite rule because R2 has no directory index.

The pod still does all the work — scraping, building, publishing — but it's reachable only on a private hostname, and the tunnel route, public gateway, and VirtualService are gone. The Terraform says it plainly:

> Nothing public reaches the home lab once the hostname moves; the cluster only ever connects OUT, to R2's S3 API.

The publisher's token can read and write objects in that one bucket and nothing else in the account, and rotates every 90 days. Egress to R2 is pinned to my account's endpoint rather than the `*.r2.cloudflarestorage.com` wildcard, because any Cloudflare customer can stand up a bucket behind that name. Uptime Kuma watches both the private status endpoint and the public copy.

**Version 0.1.107, with more than 100 CI-driven releases.** Renovate keeps base images current.

---

## Engineering summary

<ul class="pills">
  <li>Python 3.14</li><li>FastAPI</li><li>Playwright</li><li>PyMuPDF</li><li>Pillow</li>
  <li>Pydantic v2</li><li>boto3</li><li>Vanilla JS</li><li>Kubernetes</li><li>ArgoCD</li><li>Gitea Actions</li><li>Cloudflare R2</li>
</ul>

- ~3,300 LOC of application and capture code, ~1,500 LOC frontend, ~1,800 LOC tests
- **83 tests** across 15 files — adapter selection, PDF merge, scheduler time math and crash recovery, storage round-trips, static-site build and publish order, retry backoff, and offline tests of each store's parsing logic
- The FastAPI app no longer serves the public. It runs the scheduler, builds and publishes the site, serves a private preview, and exposes `/health`, `/ready`, a `/api/status` that returns 503 when any store goes stale, and a token-gated manual refresh that's off unless a token is configured
- **No LLM anywhere in it.** It's a deterministic imaging pipeline, and it should stay one.

### Honest caveats

The scrapers are **not tested against the live sites** — a test that breaks when a retailer redesigns is a test that trains you to ignore failures. Each store's parsing logic now has offline unit tests, but the real safety net is still the per-store isolation, capture validation, and the staleness alert.

There's also a genuine structural wart: the acquisition layer imports directly from `scripts/`, so what began as CLI experiments are now production runtime code, and the Dockerfile copies them in to make that work. It functions, but the package boundary is blurred and it's the first thing I'd clean up.

---

## Why it's on this site

Cortexa is the project with the most interesting architecture. Context Engine is the most technically current. big-ads is the one that gets used every week by someone who couldn't do this before.

It's also the clearest example of accessibility working as an engineering forcing function. No build step, no database, no framework, hotkeys printed on buttons, graceful degradation at every tier — all of it falls directly out of taking one user's constraints seriously. Even the move to R2 fell out of them: an app with no accounts and no writes is, publicly, just files. That's not a simpler kind of engineering. It's just engineering with the requirements pointed at a person.
