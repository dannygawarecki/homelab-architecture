---
title: Worth Keeping
eyebrow: Side Project · AI Systems
description: A system for keeping the things that matter in mind, from the dentist to a marriage, so nothing important quietly rots. Cortexa's sibling, reaching the same question from the opposite end. Unfinished.
permalink: /projects/worth-keeping/
---

<p class="pills-row">
  <span class="status status-wip">Deployed in the lab · unfinished</span>
  <span class="pill">v0.1.34</span>
  <span class="pill">Source available on request</span>
</p>

A task manager starts from *"what do I need to do?"* Most of what matters in a life isn't a task. It's a responsibility: keeping a car dependable, staying healthy, a relationship with your parents, a sump pump that's getting old. Some of these recur, some only matter when something changes, and most have nobody sending a reminder. The product's own one-line statement of the problem:

> Nothing important is allowed to quietly rot.

Worth Keeping holds a model of what a person is responsible for, what healthy looks like to them, and what it actually knows. It answers one question each time they open it: **does anything here deserve my attention right now, and why?** Often the honest answer is no, and it says why it's quiet about each of the rest.

---

## Same question as Cortexa, opposite end

The [AI arc](../) on this site keeps circling one question: what does it take to build an AI collaborator you can actually trust? [Cortexa](../cortexa/) and Worth Keeping are two routes to an answer, and they start from opposite ends.

- **Cortexa started from the conversation.** It's a collaborator you talk to. It began with code owning the whole loop, and measuring it honestly cut that back to "code decides, the model writes".
- **Worth Keeping started from the model.** Its core is a fixed, deterministic description of a person's responsibilities, with **no AI in it at all**. Evaluating a responsibility is a pure function of what's been recorded and the time you ask, so "the dental cleaning is eight months late" is arithmetic, not a judgment. AI was added later, and only at the edges, to *hear* what the person says.

Both ended up in the same place, which is why I think the answer is real: **code decides what's true, and the model is only allowed to read and write words.** Cortexa reached it by subtraction, and Worth Keeping was built on it from the first line.

---

## A model you can ask "why?"

The core keeps five append-only histories: **evidence** (what reality said), **intent** (what the person chose), **corrections** (what turned out to be misunderstood), **communications** (what Worth Keeping told them), and **responses** (what they did about it). Everything else, including state, what's expected, what's needed and how loudly to ask, is recalculated from those every time and never stored.

That's what makes it inspectable. Any card can answer "why is this showing up?" with the records it rests on, and any record can be marked "that's not right" without being erased. A few rules carry most of the weight:

- **No false all-clears.** Old evidence lowers confidence; it never turns into "all clear". Saying all clear while something drifts is the worst failure the design names, worse than nagging.
- **A person's statement isn't an event.** "It's done" is kept as what they said, never turned into an invented date.
- **The future never leaks into the past.** Tests evaluate half a year of one household at checkpoints in random order.

It's been specified the way I'd want a system I depend on specified: 34 numbered design decisions, a suite of adversarial tests written to break the model (the first run failed 14 of them, and those failures produced eight of the decisions), and tests that scan every sentence the screens can produce for words it has promised never to use ("watch", "monitor", "overdue").

---

## Where AI is allowed

AI reads. It doesn't decide.

- **The local model hears everything personal.** Telling Worth Keeping what happened in your own words, a calendar, a receipt or notice dropped in, mail forwarded in: all of it is read by the Qwen model on the lab's own GPUs ([ADR 014](../../architecture/decisions/014-vllm-inference/)). Nothing personal goes to an outside model.
- **That's enforced by a type, not by care.** An outside model can only be handed `PublicText`, and the only things that can become `PublicText` are questions Worth Keeping composed itself and text that came back from a search. Nothing a person wrote, forwarded or kept can be converted into one.
- **Look-ups are sourced, or nothing.** The first version asked the model what someone of a given age, or a given car, should keep in mind, and kept what it proposed. That's how a bone-density test was suggested at 45 and a timing-belt change for a car with a timing chain. Now Worth Keeping composes a coarse question, searches trusted sources, and keeps a suggestion only if the interval appears in a passage that came back, shown with its link. If nothing is found, it says so and suggests the owner's manual.
- **What's guessed is shown as guessed.** Anything AI proposes is kept as an assumption on the page, with where it came from, one tap from being corrected.

---

## The correction: it was too much work to keep

Worth Keeping was built to say only true things, and it does. About 21,000 generated sentences are tested for truthfulness, and 553 button presses for doing what they say. **Nothing measured what it asked of a person.**

The first person to use it, me, stopped adding things to it. The interview took too many screens for each thing, and thinking up what to keep was a chore of its own. The vision had a principle against exactly that: maintaining the model must never become another responsibility. But that principle had no test behind it, and everything that did have a test pulled the other way.

So the design was amended, and the amendment ranks the principles explicitly: **ease first, then honesty where it matters, then completeness.** A name is now enough to start keeping something, with typical defaults shown as guesses. "I don't remember" starts the clock from today instead of asking. Questions come from a weekly budget the person sets. And ease got regression tests of its own, beside the truth tests: two screens to add something, one tap to say it's done.

It's the same lesson as Cortexa's retraction, from the other side. Cortexa measured the wrong thing and had to take a result down. Worth Keeping measured only one thing, so that one thing quietly won every argument.

---

## Engineering

<ul class="pills">
  <li>C# / .NET</li><li>Blazor</li><li>PostgreSQL</li><li>Row-level security</li><li>vLLM (local Qwen)</li>
  <li>Kubernetes</li><li>Authentik / OIDC</li><li>Cloudflare Email Routing</li>
</ul>

- **About 21,000 lines of C# and Razor**, plus about 11,000 of tests. More than 500 tests as of late September, before the work on hearing began.
- **One life per person, kept apart by the database.** Every table that holds a life has row-level security forced on. Not one query mentions a household, and it refuses to start on a database role that could bypass the policy. The separation tests talk to PostgreSQL directly, *around* Worth Keeping, because a test that went through the application would be trusting the code it's meant to check.
- **No accounts of its own.** Sign-in goes through an identity provider. It keeps only a one-way key for which life to open, and the keys that sign the cookie are sealed so the database alone can't open anyone's life.
- **A weekly letter** on Sunday morning, for someone who asks for it: what needs attention, not why, answerable from the mail.
- **A simulation mode** that shows the household on another day, held only in memory, with every screen saying so.
- **About 74,000 words of design documents**: a vision, a domain specification, UX specifications, and findings write-ups from each milestone.
- Signed images through the platform's [GitOps pipeline](../../architecture/diagrams/#gitops-delivery-flow), and a Tetragon exec allow-list of its own ([ADR 020](../../architecture/decisions/020-signed-images-runtime-enforcement/)).

### Honest caveats

**It's unfinished, and it says so.** Discovering responsibilities a person hasn't mentioned, the change history of what "healthy" means, and a prompt for when someone stops engaging are all designed and not built. Its own known limitations include that a deadline with no record still counts as overdue in places.

**One user, and that user is me.** It's built so any individual could use it, but no one else has. The Ease Amendment came from my own drop-off, and whether the amended version keeps me coming back is the real open question.

**Heavily specified for a single-user app.** That's deliberate: it's holding the most personal data anything here holds. But the documents run ahead of the product in places, and the vocabulary has moved faster than some of them.

---

## Why it's here

Cortexa is the one I talk to. Worth Keeping is the one meant to notice what I've stopped talking about. They're unfinished in different ways, and I've kept them separate deliberately: if the same rule ("code decides what's true, the model only reads and writes words") holds up in a conversation *and* in a model of someone's life, I trust it a lot more than if it only held in one.
