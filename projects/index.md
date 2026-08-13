---
title: Projects
eyebrow: Side Projects
summary: One shipped accessibility tool in weekly use — and a multi-month arc of AI work converging on a single question, what does it take to build an AI collaborator you can actually trust?
permalink: /projects/
---

The homelab is the substrate. What runs on it falls into two groups.

**[big-ads](big-ads/)** stands on its own: a shipped product, in weekly use by the one person it was built for, with no AI in it at all — and that was the right call.

The rest are chapters of one story. I kept building AI tools to scratch specific itches — a way to give an assistant *current* knowledge, a way to give it *safe* access to my systems, a way to make it a genuine *collaborator* — before I understood they were three faces of a single problem: **what does it take to build an AI collaborator you can actually trust?** Cortexa is where that question finally has a name, and it's the successor the earlier attempts are folding into.

<div class="cards" markdown="0">
  <a class="card" href="big-ads/">
    <span class="card-tag">Accessibility · Shipped</span>
    <h3>big-ads</h3>
    <p>A grocery flyer viewer for a user with severe visual impairment. Four hostile retailer sites scraped on a schedule, served through a 347-line dependency-free UI. Full GitOps delivery into the cluster.</p>
  </a>
  <a class="card" href="context-engine/">
    <span class="card-tag">Knowledge · First-generation</span>
    <h3>Context Engine</h3>
    <p>Local-first RAG over files, sites, and git repos — embeddings on my own GPU, vectors in Postgres. Built and CI-tested as a standalone service; its retrieval capability is folding into Cortexa as the knowledge layer.</p>
  </a>
  <a class="card" href="policyclaw/">
    <span class="card-tag">Governance · First-generation</span>
    <h3>Policyclaw</h3>
    <p>A policy gateway that put every mutating AI action behind a human confirmation gate — Go, an OPA sidecar, per-backend risk tiers. A working prototype whose real product was the lesson, now a design input to Cortexa.</p>
  </a>
  <a class="card" href="cortexa/">
    <span class="card-tag">AI Systems · The synthesis</span>
    <h3>Cortexa</h3>
    <p>An AI collaboration engine that puts collaborative behavior in code instead of a system prompt — plus a blind-judged evaluation harness built to falsify that claim. The first run said it had. The successor the other two are converging into.</p>
  </a>
</div>

---

## The through-line

Four efforts, one question. Each solved a piece of "a collaborator you can trust," as a standalone thing, before I saw they were the same problem:

- **Knowledge — [Context Engine](context-engine/).** An assistant is only as good as what it can actually see. Local-first retrieval answers from *current* documents instead of a model's stale recollection. This is Cortexa's knowledge layer.
- **Agency — [the platform's MCP layer](../architecture/decisions/013-mcp-ai-operations/).** Eleven scoped, credential-contained servers give an assistant structured access to the real systems. These are Cortexa's hands — and unlike the other two, they stay live as platform infrastructure regardless.
- **Governance — [Policyclaw](policyclaw/).** Agency without a leash is a liability. Policyclaw made every mutating action pass a human confirmation gate. The tell that convinced me these were one project: Cortexa's code-owned memory handshake is *the same idea* — approval enforced by code, not model goodwill — rediscovered at the collaboration layer.
- **The mind — [Cortexa](cortexa/).** The frame that holds all three: something that knows, can act, and is governed, wrapped in a collaboration loop that's *measured* rather than asserted.

Two honesty notes, because the point of this site is that I don't skip them. **None of this is integrated yet** — Cortexa today consumes only Postgres and Ollama; the convergence is design intent and roadmap, not shipped software. And "successor" doesn't mean the predecessors were wasted: each was a working first-generation build whose real output was the lesson. Building them separately is *how I learned* they belonged together.

And then there's **big-ads** — no AI, no research question, just a thing someone needed that now works every week. It's here to keep the rest honest: I converge on hard problems *and* I finish and ship.
