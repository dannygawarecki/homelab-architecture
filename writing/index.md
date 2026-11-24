---
title: Writing
eyebrow: Essays
description: Longer pieces about operating this platform — the ones that are an argument rather than a decision record or a postmortem.
permalink: /writing/
---

The [ADRs](../architecture/decisions/) record what I chose and what it cost. [Lessons Learned](../lessons-learned/) records what broke. This is for the pieces that are neither: an argument I want to make, usually because working on the platform changed my mind about something.

<div class="cards" markdown="0">
  <a class="card" href="four-copies-one-medium/">
    <span class="card-tag">Sep 2026</span>
    <h3>Four Copies, One Medium</h3>
    <p>My backup design had four layers and a decision record calling them independent. A stalling disk array proved three of them were the same copy — and the alert that should have caught it couldn't start, because it was on the array too.</p>
  </a>
  <a class="card" href="everything-was-green/">
    <span class="card-tag">Sep 2026</span>
    <h3>Everything Was Green</h3>
    <p>A weekend that started with a self-signed certificate on a UPS and ended 164 commits later with seven applications that had never had a login. Almost nothing in between was broken — including the audit I got wrong.</p>
  </a>
</div>
