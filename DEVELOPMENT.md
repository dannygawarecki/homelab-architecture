# Working on this site

This repo is both a set of markdown documents (readable on GitHub) and a Jekyll site
published to GitHub Pages. **No Ruby on the host** — everything runs in Docker.

## Quick reference

| Command | What it does |
|---|---|
| `docker compose up` | Live preview at <http://localhost:4000> with auto-reload |
| `docker compose run --rm build` | One-shot build. Fails loudly if the site won't compile |
| `docker compose run --rm check` | Build **and** verify every internal link and image resolves |
| `docker compose build` | Rebuild **all** images. Needed after changing the `Gemfile` |
| `docker compose down` | Stop the preview server |

Run `check` before pushing. It's the one that catches the failure mode that matters.

## Why Docker

GitHub Pages builds the site on GitHub's own infrastructure, so Ruby is never *required* —
you can push markdown and it just works. The container exists so you can see changes
before they're public, and catch a broken build before it becomes a broken live site.

The image uses the real `github-pages` gem rather than standalone Jekyll, so a local build
matches what GitHub actually runs. Standalone Jekyll is a newer major version and would
hide version differences until they showed up in production.

## Two things that will confuse you later

**`--baseurl ''` is set on every local command.** In production the site lives at
`/homelab-architecture`; locally it's served from the root. Without the override, every
stylesheet and image 404s locally.

A side effect: the SEO canonical URLs in local output are missing the `/homelab-architecture`
segment. That's expected and only affects local builds — which is one reason the link
checker runs with `--disable-external`.

**After changing the `Gemfile`, run `docker compose build` with no service name.** All three
services share the image definition, and rebuilding only one leaves the others stale. Because
the repo is bind-mounted over `/srv`, the host's generated `Gemfile.lock` shadows the one baked
into the image — so a stale container will fail with `Bundler::GemNotFound` naming gems it
can't see. Rebuild everything and it clears.

**Never name a stylesheet `assets/css/style.css`.** The GitHub Pages gem silently loads the
Primer theme, which ships its *own* file at exactly that path. Ours is `assets/css/site.css`
for that reason — when both existed, incremental rebuilds let the theme's 136KB file
clobber ours and the whole site lost its styling. If styles ever vanish again, check what's
actually being served at the CSS path before blaming the browser.

**Updating a diagram? Rename the file.** Browsers cache images by URL, and the markdown
pages can't carry cache-busting query strings (they'd break GitHub's rendering of the same
files). So the convention is content-versioned filenames: `network-layout-v2.png`,
`-v3`, and so on — update the handful of references and every cache, everywhere, misses
cleanly. Same-name overwrites are what cause "my new diagram isn't showing."

**Link checking is deliberately internal-only.** External URLs fail for reasons that have
nothing to do with this repo — rate limits, hosts that block CI, sites that are briefly
down. A check that goes red for reasons you can't fix is a check you learn to ignore.

## Adding a page

1. Create a `.md` file with front matter:

   ```yaml
   ---
   title: Page Title
   eyebrow: Section Label      # small uppercase label above the title
   summary: One-sentence lede shown under the title.
   permalink: /some/path/      # explicit — do not rely on filename-based URLs
   ---
   ```

2. Link to it from wherever it belongs, **using its permalink** — not a `.md` path.
   Because pages declare explicit permalinks, `./foo.md` style links resolve on GitHub
   but break on the site.

3. Add it to the nav in `_layouts/default.html` if it's top-level.

4. Run `docker compose run --rm check`.

## Layout notes

- `_layouts/default.html` — header, nav, footer. Edit the nav here.
- `_layouts/page.html` — the prose wrapper. Renders `title` / `eyebrow` / `summary`.
- `assets/css/style.css` — all styling. Colors are CSS custom properties at the top and
  the whole sheet supports light and dark via `prefers-color-scheme`.
- The root `README.md` is excluded from the site (see `exclude:` in `_config.yml`). It's
  the GitHub-native entry point and points at the site.

## Publishing

GitHub Pages builds automatically on push to `main`
(**Settings → Pages → Source: `main` / root**). A build takes 1–2 minutes. If it fails,
GitHub emails you and the error appears under the repo's Actions tab.
