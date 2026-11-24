---
title: Projects
eyebrow: Side Projects
summary: One shipped accessibility tool in weekly use — and a multi-month arc of AI work converging on a single question, what does it take to build an AI collaborator you can actually trust?
permalink: /projects/
---

The homelab is the substrate. What runs on it falls into three groups.

**[big-ads](big-ads/)** and **[big-recipes](big-recipes/)** stand on their own: two accessibility tools built for the same person, with no AI in either — and that was the right call both times.

**[kubeslo-operator](kubeslo-operator/)** is the newest, and the earliest: a Kubernetes operator, written by hand in Go, that judges every change against its SLO. The groundwork is running; the operator is next.

The rest are chapters of one story. I kept building AI tools to scratch specific itches — a way to give an assistant *current* knowledge, a way to give it *safe* access to my systems, a way to make it a genuine *collaborator* — before I understood they were three faces of a single problem: **what does it take to build an AI collaborator you can actually trust?** Cortexa is where that question finally has a name, and it's the successor the earlier attempts folded into.

<div class="proj-group" markdown="0">
  <div class="proj-group-head">
    <p class="eyebrow">Stand-alone tools</p>
    <span class="proj-group-meta">2 projects · no AI in either</span>
  </div>
  <div class="cards">
    <a class="card proj-card" href="big-ads/">
      <div class="proj-top"><span class="card-tag">Accessibility</span><span class="status status-live">Shipped · in daily use</span></div>
      <h3>big-ads</h3>
      <p>A grocery flyer viewer for a user with severe visual impairment. Four hostile retailer sites scraped on a schedule in the cluster, published as a static site to Cloudflare R2 — so nothing public reaches the lab.</p>
      <div class="proj-facts">
        <span><b>4</b>retailer sites</span><span><b>61</b>CI-driven releases</span><span><b>60px</b>min button height</span>
      </div>
      <div class="proj-flaw"><span class="proj-flaw-label">Honest caveat</span>The scrapers aren't tested against the live sites — the safety net is per-store isolation, capture validation, and a staleness alert.</div>
    </a>
    <a class="card proj-card" href="big-recipes/">
      <div class="proj-top"><span class="card-tag">Accessibility</span><span class="status status-live">Deployed</span></div>
      <h3>big-recipes</h3>
      <p>The sibling: a Chrome/Edge extension that turns the recipe he already found into large type, read-aloud, cook mode, and print. It started as a search engine — and the search engine was the part that had to go.</p>
      <div class="proj-facts">
        <span><b>0</b>databases</span><span><b>0</b>internet egress</span><span><b>1,075 / 1,083</b>pages identical after stripping</span>
      </div>
      <div class="proj-flaw"><span class="proj-flaw-label">Honest caveat</span>Public requests still come through the tunnel into the lab, and it hasn't earned "in weekly use" yet.</div>
    </a>
  </div>
</div>

<div class="proj-group" markdown="0">
  <div class="proj-group-head">
    <p class="eyebrow">Reliability</p>
    <span class="proj-group-meta">1 project · Go, written by hand</span>
  </div>
  <div class="cards">
    <a class="card proj-card" href="kubeslo-operator/">
      <div class="proj-top"><span class="card-tag">Kubernetes · Go</span><span class="status status-wip">Early · groundwork done</span></div>
      <h3>kubeslo-operator</h3>
      <p>An operator that records every rollout as a <code>ChangeRecord</code> and judges it against the workload's SLO. First came the metrics, the SLOs, and <code>flaky</code> — a service built to be broken by a Git commit, and caught by a burn-rate alert 12 minutes later.</p>
      <div class="proj-facts">
        <span><b>2</b>phases done of 5</span><span><b>2</b>SLOs on the test subject</span><span><b>~930</b>lines of Go in flaky</span>
      </div>
      <div class="proj-flaw"><span class="proj-flaw-label">Honest caveat</span>The operator repository holds a README. The groundwork is real; the controller isn't written yet.</div>
    </a>
  </div>
</div>

<div class="proj-group" markdown="0">
  <div class="proj-group-head">
    <p class="eyebrow">The AI arc</p>
    <span class="proj-group-meta">2 first-generation builds · 1 synthesis</span>
  </div>
  <div class="cards proj-gen1">
    <a class="card proj-card" href="context-engine/">
      <div class="proj-top"><span class="card-tag">Knowledge · First-generation</span><span class="status">Retrieval core now in Cortexa</span></div>
      <h3>Context Engine</h3>
      <p>Local-first RAG over files, sites, and git repos — embeddings on my own GPU, vectors in Postgres. Built and CI-tested as a standalone service; its retrieval core now lives inside Cortexa as the knowledge layer.</p>
      <div class="proj-facts">
        <span><b>~91</b>commits</span><span><b>4</b>upstream doc sets indexed</span><span><b>0</b>tokens leave the network</span>
      </div>
      <div class="proj-flaw"><span class="proj-flaw-label">What carried over</span>The retrieval core, adapted into Cortexa. Its hand-tuned answerability rules — plausible, never measured — were deliberately left behind.</div>
    </a>
    <a class="card proj-card" href="policyclaw/">
      <div class="proj-top"><span class="card-tag">Governance · First-generation</span><span class="status">Archived</span></div>
      <h3>Policyclaw</h3>
      <p>A policy gateway that put every mutating AI action behind a human confirmation gate — Go, an OPA sidecar, per-backend risk tiers. A working prototype whose real product was the lesson, now a design input to Cortexa.</p>
      <div class="proj-facts">
        <span><b>Go</b>gateway</span><span><b>OPA</b>policy sidecar</span><span><b>2</b>risk tiers</span>
      </div>
      <div class="proj-flaw"><span class="proj-flaw-label">Why it was shelved</span>Opt-in governance: it protected you only as long as every client remembered to route through it.</div>
    </a>
  </div>

  <div class="proj-converge" aria-hidden="true"><span>Converged into Cortexa · harvested and ported, not called as services</span></div>

  <a class="card proj-card proj-hero" href="cortexa/">
    <div class="proj-hero-main">
      <div class="proj-top"><span class="card-tag">AI Systems · The synthesis</span><span class="status status-wip">Deployed · single user, in development</span></div>
      <h3>Cortexa</h3>
      <p>An AI collaborator running in the cluster behind Open WebUI. It began as a state machine that owned collaboration in code; honest measurement — including retracting a published win — turned it into "code decides, the model writes." Five runs: 97.8 vs 56.6 against the same model alone.</p>
      <div class="proj-flaw"><span class="proj-flaw-label">Honest caveat</span>Single user and built around this lab's hosts, and on long conversations it doesn't beat the bare model yet.</div>
    </div>
    <dl class="proj-spec">
      <dt>Code</dt><dd>~16,800 lines · 80 files</dd>
      <dt>Tests</dt><dd>431, plus a 33-scenario harness</dd>
      <dt>Decisions</dt><dd>34 ADRs</dd>
      <dt>First word</dt><dd>1.4–2.3 s</dd>
      <dt>Runs on</dt><dd>vLLM · pgvector · MCP</dd>
    </dl>
  </a>
</div>

---

## The through-line

Four efforts, one question. Each solved a piece of "a collaborator you can trust," as a standalone thing, before I saw they were the same problem:

<div class="axioms" markdown="1">

- **Knowledge — [Context Engine](context-engine/).** An assistant is only as good as what it can actually see. Local-first retrieval answers from *current* documents instead of a model's stale recollection. Its retrieval core is now Cortexa's knowledge layer.
- **Agency — [the platform's MCP layer](../architecture/decisions/013-mcp-ai-operations/).** A dozen scoped, credential-contained servers give an assistant structured access to the real systems. These are Cortexa's hands — and unlike the other two, they stay live as platform infrastructure regardless.
- **Governance — [Policyclaw](policyclaw/).** Agency without a leash is a liability. Policyclaw made every mutating action pass a human confirmation gate. The tell that convinced me these were one project: Cortexa kept arriving at *the same idea* — approval enforced by code, not model goodwill — and its tool policy is now a direct port of Policyclaw's rules.
- **The mind — [Cortexa](cortexa/).** The frame that holds all three: something that knows, can act, and is governed — and whose value is *measured* rather than asserted.

</div>

Two honesty notes, because the point of this site is that I don't skip them. **The convergence is code now, but not services**: Cortexa adapted Context Engine's retrieval core and ported Policyclaw's policy rules rather than calling either one, and it reads the cluster through the MCP layer only, read-only. And "successor" doesn't mean the predecessors were wasted: each was a working first-generation build whose real output was the lesson. Building them separately is *how I learned* they belonged together.

And then there are **big-ads** and **big-recipes** — no AI, no research question, just things someone needed that now work. They're here to keep the rest honest: I converge on hard problems *and* I finish and ship.
