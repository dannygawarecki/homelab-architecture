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

The name means making store ads *physically big*. It has nothing to do with advertising technology.

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

The interface is four giant stacked store buttons, then a fit-to-width flyer page with HOME / PREVIOUS / NEXT. That's the entire product surface.

The requirements are measurable rather than aspirational:

- Minimum button height **60px**
- Page load **under 2 seconds over 12 Mbit DSL**
- No hover dependencies, no hamburger menus, no nested navigation, no modal workflows

Every interactive control has a single-letter hotkey — and the letter is **printed visibly on the button**. Hidden keyboard shortcuts are useless to a user who can't be expected to memorize them.

The frontend is **347 lines of vanilla HTML, CSS, and JavaScript with no dependencies and no build step.** That's not minimalism for its own sake. A build pipeline is a thing that can break between me and someone who depends on this working every week.

---

## The hard part: four stores, four incompatible defenses

Each retailer publishes flyers in a way that resists automation differently, so each needed its own approach behind a shared `fetch_latest() -> FlyerPackage` interface.

### Flipp (Aldi, IGA) — a three-tier fallback chain

The hardest piece, and the one I'm happiest with. The flyer renders to a canvas inside a nested cross-origin iframe. The capture script dismisses the cookie banner, finds the postal-code frame, types a ZIP, matches a store button by `aria-label`, and locates the publication frame. Then it degrades gracefully:

1. **Sniff the API response for a `pdf_url`** and download the true source PDF — complete, perfect pages.
2. If unavailable, **passively record the CDN tile requests** the viewer makes, re-fetch every tile, and **stitch them back into full pages** — missing tiles filled white rather than failing the whole capture.
3. Last resort: **scroll and screenshot** each canvas element.

Captures are validated before publishing, and top UI chrome is auto-trimmed by pixel scanning.

The fallback chain matters because tier 1 breaks silently whenever the vendor changes their API — and when it does, the system degrades to slightly worse images instead of going dark on the person using it.

### Kroger — resolving a human address to an internal ID

There is no public API mapping an address to a store. So it downloads Kroger's **public store-locator sitemap** and token-scores store URLs against the address, then pulls pages from an undocumented internal circular endpoint, filtering for the weekly print ad.

### Save-A-Lot — recovering server state from the HTML

Flyer data is embedded in a server-rendered React context blob, so it's parsed back out of the page, with a sitemap-plus-API fallback to turn a slug URL into a numeric store ID.

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

## Deployment — the homelab doing its job

This is where the platform pays off. big-ads is fully GitOps-delivered with no manual steps:

1. Push to **Gitea**, self-hosted in the cluster.
2. **Gitea Actions** bumps the patch version, commits it back, builds the image, and pushes to the private in-cluster registry with retry and backoff.
3. The pipeline then **clones the GitOps repo and patches the image tag** in the deployment manifest.
4. **ArgoCD** reconciles and rolls it out.

The CI runner is executing *inside the cluster it deploys to*, cloning over in-cluster service DNS. Separately, editing `stores.yaml` in the app repo automatically regenerates the corresponding Kubernetes ConfigMap in the GitOps repo — config-as-code across two repositories.

**Version 0.1.9 with 9 CI-driven releases.** Renovate keeps base images current.

---

## Engineering summary

<ul class="pills">
  <li>Python 3.11+</li><li>FastAPI</li><li>Playwright</li><li>PyMuPDF</li><li>Pillow</li>
  <li>Pydantic v2</li><li>Vanilla JS</li><li>Kubernetes</li><li>ArgoCD</li><li>Gitea Actions</li>
</ul>

- ~936 LOC of application and capture code, 347 LOC frontend, 320 LOC tests
- **12 tests** across API, acquisition, config, scheduler, and storage — covering adapter selection, PDF merge, scheduler time math and crash recovery, and storage round-trips
- 6 HTTP endpoints, including `/health` and `/ready` probes
- **No LLM anywhere in it.** It's a deterministic imaging pipeline, and it should stay one.

### Honest caveats

The scrapers themselves are **not covered by tests** — they hit live sites, and a test that breaks when a retailer redesigns is a test that trains you to ignore failures. The real safety net is the fallback chain plus capture validation.

There's also a genuine structural wart: the acquisition layer imports directly from `scripts/`, so what began as CLI experiments are now production runtime code, and the Dockerfile copies them in to make that work. It functions, but the package boundary is blurred and it's the first thing I'd clean up.

---

## Why it's on this site

Cortexa is the project with the most interesting architecture. Context Engine is the most technically current. big-ads is the one that gets used every week by someone who couldn't do this before.

It's also the clearest example of accessibility working as an engineering forcing function. No build step, no database, no framework, hotkeys printed on buttons, graceful degradation at every tier — all of it falls directly out of taking one user's constraints seriously. That's not a simpler kind of engineering. It's just engineering with the requirements pointed at a person.
