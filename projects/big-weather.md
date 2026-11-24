---
title: big-weather
eyebrow: Side Project · Accessibility
summary: The third tool for the same reader. He likes weather and likes comparing sources. The sites that compare forecast models are some of the most crowded pages on the web, so big-weather does the comparing and shows the answer in very large type.
permalink: /projects/big-weather/
---

<p class="pills-row">
  <span class="status status-live">Deployed · November 2026</span>
  <span class="pill">Version 0.1.18</span>
  <span class="pill">Source available on request</span>
</p>

[big-ads](../big-ads/) magnifies images and [big-recipes](../big-recipes/) restyles text. big-weather is the first of the three where the hard part is **deciding what to say**. He doesn't want one forecast; he wants to know whether the forecasts agree. Mainstream apps show one source. The sites that compare models show all of them, in a dense grid of numbers that's unusable under heavy magnification.

So big-weather reads eight sources and does the comparison for him: the Weather Service, six forecast models (American, European, German, Canadian, the NWS blend, and the short-range HRRR), and a local TV station's own forecast. Then it says the result plainly.

---

## How it works

It follows the big-ads model exactly. **A generator runs on a schedule, and the browser only displays files.** Every ten minutes a Kubernetes CronJob refreshes whatever is due (forecasts every 30 minutes, radar every 10, measured weather hourly), works out where the sources agree, draws the radar frames, and uploads a static site to Cloudflare R2. Nothing in the cluster serves visitors, and nothing listens for requests.

A source failing never fails the run. The page shows the sources it has, and the details list names the missing ones. If fewer than two sources cover a day, there's no agreement view at all, just the one source, labelled. After two hours without a good run, every page says in large type that the data is old.

---

## The comparison had to get smaller

The first version showed the comparison everywhere: every row carried its spread and its count of sources for and against. It was accurate, and it took over the screen. The commit that changed it:

> The comparison was taking over every row. The main views now give one answer and keep who-said-what on the day's details page.

Now temperatures are the middle of the sources, never a range. Rain and snow say how sure in **words**, from the share of sources that expect it: *expected*, *likely*, *possible*, *slight chance*, or *dry*. A "sources differ" mark appears only when it matters, when rain is a genuine toss-up or the highs are more than 8° apart. The disagreement, when he wants it, is named: "Low: 26° Canadian to 32° German", "Rain: only Blend says yes".

Two details I'd point to, because they're the kind of thing that only shows up when you look at real output:

- **Three "independent" rain chances were the same number.** The free model API returned identical rain probabilities for the American, short-range and blend models, because they come from one ensemble. Counting them as three votes would have faked agreement. Rain is judged from each model's forecast *amount* instead, and percentages come only from sources that compute their own.
- **The Weather Service could contradict the answer.** A day once read "Chance Rain Showers. Dry": the sky came from the Weather Service whatever the models said. Its words and icon are now used only when they fit the sources' answer.

---

## Public, without a login, and without a location

He should never have to sign in, so the site is public. Instead of protecting the site, the rule is that **the site never contains anything more precise than "this general area"**, and the repository never contains anything that identifies the family at all.

- **Locations live only in Vault.** The repository holds a format example with made-up places; the real file arrives as a Kubernetes Secret via External Secrets. A missing file fails the run with an error that names the file but echoes nothing from inside it, and there's no fallback to built-in locations, because that's how real places end up in code.
- **Radar centres on home rounded to about 3–4 miles**, drawn as a "home area" circle, never a pin. Town labels show only larger towns.
- **Every build is checked** for coordinates, forecast-grid IDs and API addresses before it replaces the live site. A build that fails the check is thrown away.
- **Gitleaks has a custom rule** that flags precise coordinates in any committed file, in pre-commit and in CI.
- **Errors are published as "failed", never as text.** The HTTP client's errors include the request URL, and the request URL includes coordinates.

What's left exposed is about what a weather app's saved-locations list reveals. If that's ever too much, a login can go in front with no code changes.

---

## Accessibility, and one house style

big-weather was laid out like the Windows weather app he already knows (now, an hourly strip, a daily list), only much bigger. Each screen fits on one display without scrolling. Single keys move between screens (**H**ourly, **D**ays, **R**adar, **P**ast weather), number keys pick a day or a radar frame, **A** reads the screen aloud, and **Esc** goes home. Radar is still frames he can step through and enlarge, with forecast frames given a dashed border that says they aren't real radar.

All three tools are used by the same person, so they now **look and work the same**: one `house.css`, the same file in all three repositories, carries the font (Atkinson Hyperlegible Next, self-hosted), the light and dark screens, the button style, the yellow key badges and the focus ring. **T** switches light and dark in every app; **Esc** always backs out. Each app keeps only its own sizes and its own colours.

---

## Engineering summary

<ul class="pills">
  <li>Python 3.14</li><li>httpx</li><li>Pydantic</li><li>NumPy</li><li>Pillow</li><li>Vanilla JS</li>
  <li>Kubernetes CronJob</li><li>Vault + External Secrets</li><li>Cloudflare R2</li><li>Gitea Actions</li>
</ul>

- **Generator:** about 3,500 lines of Python, no web framework
- **Viewer:** about 980 lines of JavaScript and 610 of CSS
- **61 tests**, using made-up places and a fake internet; none needs the private locations
- **No AI anywhere in it.** Agreement is arithmetic with thresholds in a settings file; read-aloud is the browser's own speech synthesis.
- **Built in three days**, from spec to shared house style, 12–14 November 2026, on the same [GitOps pipeline](../../architecture/diagrams/#gitops-delivery-flow) as everything else.

### Honest caveats

**It emptied its own site once.** A run started by hand overlapped the scheduled one. They swapped the build folder under each other, and the second upload deleted the files it hadn't seen, so most of the live site was gone for four minutes. A lock on the data volume now makes a second run skip. A sync that deletes is only as safe as the folder it's syncing from.

**The measured weather is mostly estimates.** "What really happened" comes from a radar-based estimate at the point, worded "about". Airport readings and official climate reports are designed but not built yet, and "who was right?" scoring of each source against the actuals is phase two.

**It's two weeks old.** big-ads earned "in daily use" through months of fixes driven by real use. big-weather hasn't had those months.

---

## Why it's here

The three tools share a reader, a house style, and no AI in any of them. What big-weather adds is the problem of **saying less**. Eight sources, a dozen fields and a radar are easy to show; the work was deciding what a single glance should tell him, and keeping everything else one key away.
