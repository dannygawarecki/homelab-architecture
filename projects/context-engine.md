---
title: Context Engine
eyebrow: Side Project · Retrieval
summary: A local-first RAG platform — ingest files, sites, and git repos, embed them on my own GPU, and answer questions without a single token leaving the network.
permalink: /projects/context-engine/
---

<p class="pills-row">
  <span class="status status-wip">First-generation · folding into Cortexa as its knowledge layer</span>
  <span class="pill">Source available on request</span>
</p>

Context Engine is the **knowledge** chapter of a longer story ([the through-line is here](../)): the first-generation answer to "how does an assistant know *current, real* things instead of whatever it half-remembers?" It's a working service — Dockerfile, CI pipeline, real ingestion — but it's no longer maintained as a standalone box, and that's deliberate. The retrieval capability built here is folding into [Cortexa](../cortexa/) as its knowledge layer; keeping it running twice would be wasted work.

The premise was straightforward: retrieval-augmented generation is genuinely useful, and every hosted option requires shipping your documents to someone else. With a GPU worker already in the cluster, there was no reason to. What I didn't see at the start was that "give the assistant good knowledge" was one face of a bigger question — being a collaborator you can trust — which is the question [Cortexa](../cortexa/) exists to answer.

---

## What it does

Ingests **files, websites, and git repositories**, embeds them locally through Ollama using `nomic-embed-text`, stores the vectors in **PostgreSQL with pgvector**, and answers questions against that corpus.

Using Postgres + pgvector rather than a dedicated vector database was deliberate. CloudNative PG already runs in the cluster with WAL archiving to MinIO and a working backup story — see [ADR 010](../../architecture/decisions/010-cloudnative-pg/). Adding a vector extension to a database I already operate well beat adding a new stateful service I'd operate badly.

---

## Engineering

- **Python / FastAPI** service, ~91 commits of real iteration.
- **Containerized**, built by a **Gitea Actions** pipeline running on the homelab's own Gitea instance — the CI is self-hosted alongside everything else.
- Module boundaries are drawn around capabilities rather than layers: `retrieval`, `retrieval_hub`, `websearch`, `toolmesh`, `context_compiler`, `temporal`, `ui`, `routers`.
- **PostgreSQL + pgvector** for storage, **Ollama** on the GPU worker for embeddings.

### `ctx` — the companion CLI

A deliberately thin client with a tightly-scoped contract: discover files, apply ignore rules, detect what changed, upload to the Context Engine API. It is explicitly **not** responsible for parsing, chunking, embeddings, or vector writes.

That boundary is the whole design. Keeping the client dumb means the ingestion pipeline can change entirely without shipping a new CLI to anyone.

---

## The corpus

The first real workload was indexing upstream documentation for the tools I actually run — ArgoCD, cert-manager, Kubernetes, and Talos — so I could ask questions against current docs rather than a model's recollection of them.

This lands directly on a problem named in my [AI-assisted engineering notes](../../copilot-experiments/): AI tools are weakest when assembling recent versions of fast-moving components. Local retrieval over current documentation is a direct attack on that failure mode.

---

## Where it's going

Cortexa's design calls for a knowledge layer, and Context Engine is that capability in waiting. To be exact about what exists: they are **not integrated today** — Cortexa has no retrieval hooked up yet, and this is stated intent, not a shipped feature. What Context Engine already proved is the hard part — that local-first retrieval over your own corpus, embeddings and all, works end to end without a token leaving the network. The remaining work is composition, not invention: lifting that capability into Cortexa rather than running it as a separate service. See [Cortexa's lineage section](../cortexa/#what-its-the-successor-to) for how the pieces fit.
