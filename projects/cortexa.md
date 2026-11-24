---
title: Cortexa
eyebrow: Side Project · AI Systems
summary: An AI collaborator for one person and one lab, running in the cluster behind Open WebUI. It started as a state machine that owned collaboration in code; measuring it honestly is what replaced that design, and what retracted the result this page used to report.
permalink: /projects/cortexa/
---

<p class="pills-row">
  <span class="status status-wip">Deployed in the lab · single user, in active development</span>
  <span class="pill">v0.1.20</span>
  <span class="pill">Source available on request</span>
</p>

Most AI assistants encode their behavior in a system prompt. Ask for something better and you get a longer prompt. Cortexa started from a different question: **what happens if the collaboration itself is owned by code?**

The project rests on one claim, stated in its own design docs as something that could be proven wrong:

> Does the Cortexa loop produce measurably better collaboration than the same model driven by a good system prompt with memory? … If it does not, the architecture is ceremony.

That sentence is still why this project is on this site. The answer turned out to be more interesting than the one I first published — and part of this page is a correction.

---

## Where it started

The first Cortexa modelled each turn as an explicit state machine — **Observe → Understand → Decide → Contribute → Reflect → Adapt** — where every step produced an immutable, inspectable object, so you could see what the system understood and why it chose what it did, as data rather than a transcript.

The part I cared most about was **code-owned memory**. The model could *propose* remembering something; only deterministic code could write it, and only after an approval handshake whose wording code rendered, never the model. A user's memory shouldn't depend on a model's goodwill on a given turn.

To find out whether any of that was worth it, I built an evaluation harness that ran the full loop against the *same model* with one good collaborator prompt and naive memory, and had a blind LLM judge score the transcripts.

---

## A correction to this page

**An earlier version of this page reported that Cortexa beat the baseline on Learning and Ownership. That result was retracted on 19 July 2026, and it should not have stayed here after that.**

The evaluation used a blind LLM judge scoring transcripts 0–2 on five dimensions. Two instrument failures sank it:

1. **Same-model judging inflates scores.** Runs where the judge was the model that wrote the answers scored 2.00 across the board. Pointed at a *different* model's transcripts, the same judge immediately found failures it had scored perfect.
2. **The cross-check judge couldn't use its own scale.** A second model, brought in as judge, wrote justifications that contradicted its scores — describing textbook handling of a memory decision, then scoring Ownership 0.

On top of that, both systems hit the ceiling on strong models, and nine scenarios with ±0.2 judge noise can't resolve effects that small. The question was **unanswered — not confirmed and not falsified**. Every judged score from that period is retracted; the latency and hardware measurements, which never depended on a judge, stand.

---

## What actually answered the question

Two measurements that didn't need a judge settled more than the judge ever did.

**A blind human preference test.** I labelled pairs of transcripts — Cortexa against the same model with one good prompt — without knowing which was which, on one criterion: *which assistant would I rather work with?* In the first round, on 19 July, **the baseline won 9 of 9**, even though Cortexa won the deterministic protocol checks 12 to 7. The project's notes put it in one line: *Cortexa currently wins the protocol and loses the person.*

The causes were in the voice, not the architecture: a brevity cap that made replies clinical, handshake wording that was protocol-correct and robotic, and a prompt that simply read colder than the baseline's. A warmer register, rewritten handshake wording, and replies that named the options considered and rejected — each round checked against fresh blind pairs — moved the preference to 4–3 for the baseline and then **5–2 for Cortexa** by 28 July. My own caveat at the time was that even when I picked Cortexa, it was for the behaviour, not the response. It was winning on protocol and being tolerated on prose.

**A stopwatch.** Even then, the collaboration loop took a median **9.15 seconds** per turn on a model that starts answering in 0.06 s. The time went into routing votes and structured judgments — the model being asked to be precise in exactly the places it was weakest — before it was allowed to do the one thing it was good at: write an answer from good context.

So in late September the design inverted. **Code decides, the model writes.** Code decides what the model sees — which documents, which memories, which cluster reads, whether to search the web — and the model makes **one streamed call**. The first word now arrives in **1.4–2.3 seconds**. On 4 October the original state machine was deleted outright: about 110 of the package's 129 modules, and 27 test files. Keeping two runtimes meant the harness was measuring the one that didn't ship.

The thesis survived in a narrower, more defensible form. It's not "a loop in code makes a better collaborator." It's **"the platform around the model is what makes it useful, and that platform is code."**

---

## What it is now

Cortexa runs in the cluster as an OpenAI-compatible API, and **Open WebUI is its interface** — every chat in the lab's web UI goes through it. Generation is the platform's vLLM ([ADR 014](../../architecture/decisions/014-vllm-inference/)); embeddings come from Ollama. Each message passes through lanes, and code decides which ones run:

- **Documents.** A self-managed corpus — about 4,900 documents and 42,000 chunks: my own documents, and upstream documentation pinned to the versions the lab actually runs — searched every turn. Passages are used only above a similarity bar that was measured, not argued: on-topic questions score 0.86–0.92, off-topic ones top out around 0.78, so the bar sits at 0.80.
- **Memory.** Asking to remember *is* the approval — "remember that…" is saved by code, never by the model. Cortexa may *offer* to remember something said in passing, and only a plain yes saves it. Every memory sent to the model carries the reason it was sent, and the reply's footer shows which ones went.
- **The live cluster.** Questions about the lab read it through the Talos and Kubernetes MCP servers ([ADR 013](../../architecture/decisions/013-mcp-ai-operations/)), against an allow-list of named, read-only tools. "How many pods are unhealthy?" is counted in code over every row before the model sees anything, so the number is never a guess.
- **The web**, through self-hosted SearXNG — only when asked, or when the question is about what's new, and with private hostnames and addresses stripped first. It's the only lane whose traffic leaves the house.
- **Saying what wasn't checked.** A search or cluster read that fails is told to the model and shown to me, and every passage carries how current it is. An answer built on a lookup that silently failed is the failure this project trusts least.

### What it may change

**Cortexa never changes a running system.** Its largest act is a pull request: after a review, "fix those" has the model draft the edits, code validate and apply them, and a branch open on an allow-listed repository. Its Gitea account can't push to `main` or merge. Argo CD deploys what *I* merge. Anything the cluster has that Git doesn't, Cortexa explains and hands me the command to run myself.

---

## Measuring the product

The evaluation now drives the product itself, across 33 scenarios, scored by **invariant checks** — deterministic tests on each transcript — instead of a judge. The comparison is Cortexa against **Bare**: the same model, the same persona, and nothing else. The margin is what the platform adds.

Five runs, 4 October, on the in-cluster model:

| | Cortexa | Bare |
|---|---|---|
| Total, of 111 | **97.8** (96–101) | 56.6 (55–58) |
| Content, of 77 | **68.0** (67–71) | 52.6 (51–54) |
| Content margin per run | **+15.4**, sd 2.7 | |

Read that carefully, because the level means less than it looks. A model that answers *nothing* scores 39 of the 77 content points — absence-phrased checks are satisfied by silence, which the project found the hard way. Above that floor, Cortexa earns about 29 of the 38 points available, and Bare about 14.

Where it wins: **private documents** (24 against about 4, every run), **live capability** (20 against 13), and **the web** (7 against 2). Where it doesn't: **long conversations** — 18.6 against Bare's 19.6. On those, it adds nothing yet.

The harness found real defects, and also wrong checks. A phrase list missed "I cannot directly execute," and so scored a correct refusal as a failure; two more checks rejected right answers. Each was fixed only after reading every failing transcript, never edited to fit a single run. Re-scored with those fixes, the same five runs give 99.6 against 56.6.

---

## Engineering

- **Python**, about 16,800 lines across 80 source files. Two base dependencies: **Pydantic** and **PyYAML**. No agent framework.
- **431 tests**, behaviour and integration tiers, plus a scenario harness that runs at concurrency 8 (548 s for the full set).
- **34 ADRs**, written as decisions were made. ADRs 0023–0032 define the product; the earlier ones that describe the retired loop say so at the top.
- **PostgreSQL with pgvector**, in the cluster. Tables are created on first use; the classic migrations went with the classic loop.
- **CI on the platform pipeline**: secret scan, tests, build, image checks, vulnerability scan, **cosign signature and SBOM** ([ADR 020](../../architecture/decisions/020-signed-images-runtime-enforcement/)), and a tag bump that Argo CD deploys. Twenty releases since 2 October.
- **Runtime-contained**: Cortexa's pod has a Tetragon exec allow-list enforced with SIGKILL, and its service account may reach only the Kubernetes and Talos MCP servers.

### Honest caveats

- **It's a single-user, home-lab product.** Its defaults name this lab's hosts, and running it on someone else's hardware hasn't been written or tested.
- **Long conversations don't benefit yet**, per the numbers above.
- **Fact recall is about half of what a person would expect.** Standing preferences always go to the model, but the embedder measures topical closeness, not "this is what the question is about," and only about half the expected facts clear the bar.
- **If the corpus is unreachable, the product answers without documents** and only its logs say so. The harness now refuses to score that case; the product still does it.

---

## What the homelab gave it

Cortexa is the platform's heaviest AI consumer, and the dependency runs both ways.

**The model was chosen by a bake-off on Cortexa's own checks.** Qwen3.6-35B-A3B beat the coder model it replaced 75 to 74 out of 75, kept decoding speed flat out to 58,000 tokens of context, and holds twice the KV cache — at a cost of about half a second more to the first token. A Gemma 4 candidate couldn't run at all on two 12 GB cards. That bake-off is why vLLM now serves a 128k window.

**Before vLLM, it produced the platform's sharpest hardware finding** — a model that doesn't fully fit in VRAM is unusable, and Mixture-of-Experts is the worst case, because the router hits CPU-resident experts on most tokens. Single-stream Ollama, 2× RTX 3060:

| Model | Loaded | On GPU | Speed |
|---|---|---|---|
| `qwen3-coder:30b` @ ctx 8192 | 19.5 GB | 100% | **80 tok/s** |
| `gemma4:26b` @ ctx 4096 | 17.5 GB | 100% | **56 tok/s** |
| `qwen3.6:27b` @ ctx 4096 | 16.8 GB | 100% | **18 tok/s** |
| `qwen3.6:27b` @ ctx 8192 | 18.1 GB | 94% | 4.9 tok/s |
| `gemma4:31b` | 21.7 GB | 85% | 1.5 tok/s |
| `qwen3.5:35b-a3b` (MoE) | 22.3 GB | 80% | 2.0 tok/s |

Dropping one model's context from 8,192 to 4,096 freed about 1 GB and took it from 4.9 to 18 tokens a second by making it fully resident. A 4× speedup from a context setting is the kind of thing you only learn by measuring your own hardware.

---

## What it's the successor to

Cortexa is where the AI work on this platform converged. Three earlier efforts each solved one piece of "a collaborator you can trust" before I understood they were one problem — and in two of the three cases, the convergence is now code rather than intent:

- **Knowledge — [Context Engine](../context-engine/).** Cortexa harvested its retrieval core — the pgvector schema, the heading-aware chunker, ingestion, hybrid vector and full-text search with rank fusion — and the scanning and change detection from its `ctx` CLI. Adapted, not imported: Cortexa doesn't call Context Engine as a service. What it didn't take was Context Engine's hand-tuned layer of answerability and sufficiency rules — plausible constants, none of them measured. That's the same pattern the evaluation caught in Cortexa's own loop.
- **Agency — [the platform's MCP layer](../../architecture/decisions/013-mcp-ai-operations/).** Cortexa reads the cluster through the Talos and Kubernetes servers, read-only, every tool named.
- **Governance — [Policyclaw](../policyclaw/).** Cortexa's tool policy is a direct port of Policyclaw's OPA rules for the same twelve servers — deny-first, qualified tool names, a reason code on every decision — with a stricter allow-list on top. And Policyclaw's core idea, that a consequential action needs a human's yes, survives as the rule that Cortexa's largest act is a pull request someone else has to merge.

What *isn't* there: Cortexa can't act on the cluster directly. The original loop had a confirmed-action lane for two narrow Kubernetes tools; it was removed with the loop, and bringing it back is its own decision.

---

## Why this project matters to me

I built an instrument to tell me whether the architecture was worth it. Then I found out the instrument was broken — after publishing a result from it. The result came down, the instrument was rebuilt around checks that don't need a judge, and a blind test I couldn't argue with said the baseline was better. Winning that test back took fixing the voice, and even the win showed the structure wasn't what earned it. The architecture changed to match the evidence: most of the code I'd written to own collaboration was deleted, and the product got faster and better.

The engineering I'm proudest of isn't any of the lanes. It's being willing to retract a published win, delete the design it was built on, and keep the claim falsifiable.
