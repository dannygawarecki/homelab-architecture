---
title: AI-Assisted Engineering
eyebrow: Practice
description: How AI tooling changed the way this platform gets built in 2026, what still holds from the early lessons, what expired, and the one project where AI teaches instead of writes.
permalink: /copilot-experiments/
---

This page started in early 2026 as notes on GitHub Copilot and Claude in Copilot Chat: autocomplete, a chat window, and logs pasted in by hand. By the middle of the year the tools had changed underneath it, and a good share of what I'd written down as hard-won lessons stopped being true.

I've kept the original notes at the bottom, as written. What's above them is what I'd tell someone now.

---

## How I work now

Since July, most changes to this platform are made by an **agentic assistant (Claude Code) working in the repositories themselves**. It reads the code, runs the commands, queries the live cluster through the [MCP servers](../architecture/decisions/013-mcp-ai-operations/) or CLIs, and writes the commit. I decide what should happen and whether what came back is right.

The GitOps repository shows the switch better than I can describe it. My commits that carry an AI co-author line, by month:

| 2026 | Jan–Jun | Jul | Aug | Sep | Oct | Nov |
|---|---|---|---|---|---|---|
| Co-authored | **0** of 778 | 67 of 77 | 60 of 92 | 122 of 126 | 136 of 144 | 68 of 68 |

The same is true of every commit of mine since September in [big-weather](../projects/big-weather/), [Cortexa](../projects/cortexa/) and [Worth Keeping](../projects/worth-keeping/). The exception is [kubeslo-operator](#flipping-the-script-where-ai-teaches-and-i-write), on purpose.

### More than one agent, each for a reason

Claude Code does most of the building, but not all of the thinking. I use other tools where a second, different point of view is worth more than speed:

- **Codex, played against Claude.** When a decision needs deeper thought or a result needs validating, I give the same problem, or Claude's answer, to Codex and make the two disagree. Two models trained differently don't share the same blind spots, and where they part ways is usually where I need to look hardest. It's the same instinct as [building the verifier](#what-still-holds): don't let the thing that produced an answer be the only thing that checks it.
- **Google Stitch for front-end design.** When the work is what a person sees, I use Stitch to refine the UX. [big-recipes](../projects/big-recipes/)' visual redesign began as Stitch mockups, and [big-weather](../projects/big-weather/)'s screens were reworked from a Stitch design pass a day after its first build; both were then amended by hand against the accessibility rules. A design tool is better at proposing a layout than a coding agent is, and a coding agent is better at holding it to the rules.
- **Several agents at once, where the work splits cleanly.** Independent changes run in parallel, each in its own worktree on its own branch, and come back to me as separate pull requests. The rule that makes it safe is the same one I'd use with people: never two writers on the same files.

Three things changed in how the work feels:

- **My time moved from typing to deciding and reading.** In that one repository I've merged 475 pull requests since September. The work is in the review: is this the right change, is it the whole change, and will it work as intended.
- **The *why* now lands in the repo.** Commit bodies and Terraform comments in these repositories run to paragraphs, because the reasoning from the conversation goes into them at the moment it's decided. That's what made this site's [lessons](../lessons-learned/) and the newer ADRs possible to write accurately: the evidence was sitting in the history, explained.
- **Access is the real design question.** An assistant that can act is only as safe as what it's allowed to touch. Cortexa can read the cluster but can't change it, and its largest act is a pull request I have to merge. The nightly [credential-rotation runner](../architecture/decisions/021-credential-rotation/) can't widen its own permissions. Argo CD deploys what's merged, and nothing else.

One quirk I didn't expect: **it remembers what I skipped.** More than once, it handed me a list of things to do, I came back with questions before I'd finished the list, and a few exchanges later the item I'd skipped resurfaced, with a pointed note that it was still open. It's not wrong, and those items absolutely it mattered. There is a lot in common with a gruff senior engineer who doesn't say "I told you so" but makes sure you know they noticed. I definitely was not expecting that!

---

## What still holds

Some of the early lessons were about the tools' limits and expired with them. These were about the work, and if anything they matter more now that more of it is generated.

- **AI can reconstruct *what*, never *why*.** Pointed at the configs, an assistant could tell me exactly how Vault is wired. It couldn't tell me I picked Vault because I use it at work. The fix turned out to be the second point above: capture the *why* when it's decided, and there's something real to read back later.
- **Fluent wrongness about your own system is still the dangerous kind.** A draft of the Cilium ADR said moving to Talos *forced* a CNI decision. That was tidy, plausible and false, and it read exactly like the true sentences around it. Only knowing my own cluster caught it.
- **Build the verifier, not just the change.** This site has a link checker that runs before every push, Cortexa has its scenario harness, and the rotation runner reports a quiet night as a quiet night. The faster a tool produces plausible output, the more the check has to run at the same speed.
- **AI judging AI is a noisy instrument.** Cortexa's published result came down because a model graded its own homework. Deterministic checks and my own blind preferences replaced the judge.
- **Irreversible actions get my own check**, however confident the suggestion sounds.
- **The first answer is the common cause, not always the true one.** "What could we measure that would tell these apart?" is still the question that moves an investigation from guessing to finding.

---

## What expired

- **"Give it the file and the goal before asking."** Context-first prompting was the most useful pattern I had in spring. An agent that reads the repository itself, and queries the live cluster, makes it mostly unnecessary.
- **"It doesn't know your cluster."** It does now, through MCP, from the cluster itself rather than from my description of it.
- **Boilerplate and refactors as the headline win.** Turning six Terraform resources into one `for_each` felt like magic in March. It's table stakes now, and not worth a paragraph.
- **Wrong schemas for newer providers, and going in circles.** Both still happen, much less often, and the first is usually caught by validation before I see it.

---

## Flipping the Script: Where AI Teaches and I Write

Almost everything above is AI writing and me checking. [kubeslo-operator](../projects/kubeslo-operator/) runs the other way on purpose. **I write the Go by hand. The AI reviews it, explains it, and quizzes me on it, but it doesn't author it.** The goal is to understand a Kubernetes reconcile loop well enough to write one from a blank file, and there's no way to get that by reading someone else's.

Against the table above, the difference is stark: **none of the 19 commits in `flaky`**, kubeslo's test service, carry an AI co-author line. The messages read like it, too: "Table-driven tests", "More tests, I wasn't done yet", "oops".

It's slower, and that's the point:

- **flaky took about twelve days for roughly 930 lines of Go.** big-weather, written the usual way, reached about 3,500 lines of Python in three.
- **What I got for the extra time is the design.** The constraints on the kubeslo page didn't come from a suggestion. A revert reuses an old ReplicaSet. A config change keeps the same version label. An error query that returns *nothing* isn't the same as one that returns zero. They came from watching my own code misbehave in the cluster and understanding why. That last one was a fix I made myself: initialising flaky's request counters so the query has something to return.

The rule of thumb I've landed on: **when the code is the product, let AI write it and verify hard. When understanding is the product, write it yourself and let AI be the reviewer who never gets tired of "why?"** Picking which one a project is, before starting, is most of the decision.

---

## The original notes (early 2026)

<details markdown="1">
<summary>Written when the tools were autocomplete and a chat window. Kept as written.</summary>

Notes on using AI tooling — GitHub Copilot, Claude via Copilot Chat, and more recently agentic assistants with direct access to my repos and cluster — to accelerate infrastructure work on this platform. Not a sales pitch: an honest account of where it added leverage and where it didn't.

AI has genuinely sped up both my progress and my learning on this project. It has also set me back a few times — by confidently assuring me that a destructive action would be fine, or by assembling plausible-looking solutions from outdated pieces that didn't quite fit together.

I've settled into a rhythm. I've learned what AI tools are good at and how to use them effectively. The short version: they're great at troubleshooting an existing, known system. They're good at coding patterns and boilerplate. When you're trying to assemble the most recent version of several moving parts into something that works, you have to be careful — and you have to trust your gut when something feels wrong.


### Where It Helped

**Terraform refactoring.** Turning six copy-pasted `uptimekuma_monitor_http` resources into a single `for_each`-driven resource with a `locals` map was a 30-second conversation rather than a 10-minute manual edit. Copilot understood the pattern, generated idiomatic HCL, and got the conditional `accepted_status_codes` logic right on the first try. And then it scaled up from 6 to 37 almost instantly.

**Debugging container issues.** Given the failure context and a description of what the container should be doing, Copilot is very good at identifying the root of an issue. The pattern that works: supply the relevant logs, describe what you expected, and ask what's wrong — not "fix this" necessarily, but "what does this tell you?" This produced accurate diagnoses for issues ranging from Hermes agent misconfiguration to failed iSCSI mounts. The key is that Copilot is reasoning about known software behaving in a known way; when it's a configuration interaction specific to your setup, you still have to supply that context explicitly.

**Generating boilerplate.** ArgoCD Application manifests, Kustomization stubs, and Helm values files all follow predictable patterns. Copilot generates working first drafts that need light editing rather than blank-page starts. It's especially powerful when following a pattern that already exists somewhere else in the ecosystem.

**Creating this wiki.** This entire architecture repo was built collaboratively with AI. I provided the raw material — the repos, the diagrams, the story of how the platform evolved — and the assistant helped structure it into something coherent. The ADRs were a back-and-forth: I described a decision and the tradeoffs I remembered living through, and it shaped them into the format and filled in reasoning I had internalized but not articulated. The result reads like something I wrote, which is the point — it reflects real decisions made for real reasons, not generated fluff. The practical lesson: AI is very good at helping you externalise what you already know.

**Reading my own repos back to me.** Writing the ADRs meant reconstructing decisions from configs I hadn't touched in months. Pointing an assistant at `home-lab-argocd`, `home-lab-terraform`, and `home-lab-talos` and asking for specific facts — which auth backends, what the egress policies actually cover, how the runners are deployed — produced an accurate inventory far faster than I could have re-derived it. It also **corrected me**: I quoted a monitor count from memory, and reading the actual Terraform showed I was wrong. That's the underrated use — not writing code, but fact-checking your own recollection against what's really deployed.

**Large mechanical refactors, done safely.** At one point I restructured this site's ADR files — filenames, permalinks, titles, and around thirty cross-links, all of which had to change together. Done by hand it's a guaranteed broken-link hunt. Scripted, it took one pass — and the genuinely valuable part was having the assistant also write a *checker* that verified filename, title, and permalink agreed on every record and that no link label disagreed with its target. The edit was the easy half; the verification was the half that made it safe.

**Live cluster context via MCP.** Standing up MCP servers ([ADR 013](../architecture/decisions/013-mcp-ai-operations/)) changed the quality of answers more than any prompting technique. Instead of me pasting terminal output, the assistant queries actual ArgoCD sync state, real node health, live Vault mounts. Troubleshooting stops being "here's what I think is happening" and starts from ground truth. This is the single biggest upgrade in how I work with these tools.


### Where It Struggled

**Provider-specific edge cases.** Copilot's training data for newer Terraform providers (bpg/proxmox, breml/uptimekuma) is sparse. It sometimes generated resource schemas that were slightly wrong — using attribute names that didn't exist or missing required fields. Always validate against the provider docs.

**Cluster-specific context.** Copilot doesn't know your cluster. When debugging something that requires understanding how Cilium, Istio, and Talos interact on your specific nodes, it gives generic answers. You have to supply the context. MCP and CLI access has been a big help in this area!

**Assembling cutting-edge stacks.** When you're putting together components that are individually well-documented but rarely combined — say, Talos + Cilium + Istio ambient mode + GPU passthrough — the AI is working from training data that may predate the current versions or miss the interaction-specific gotchas. This is where it has cost me time.

**Confidently wrong about destructive actions.** The most dangerous failure mode: Copilot assures you that something is safe when it isn't. I've had moments where I trusted that assurance and instantly regretted it. The solution isn't to stop using AI — it's to treat irreversible actions as requiring your own independent verification, regardless of how confident the suggestion sounds.

**Confidently wrong about my own platform.** A draft of the Cilium ADR opened by explaining that migrating to Talos *forced* an explicit CNI decision. It's a tidy, plausible premise — and it's false. Talos ships with Flannel; it works fine. I replaced Flannel deliberately, because I wanted real network policy and because Cilium pairs well with Istio ambient. Nothing flagged this as invented; it read exactly like the true sentences around it. The only reason it got caught is that it's *my* cluster. Fluent wrongness is indistinguishable from fluent rightness until it collides with something you actually know.

**The first diagnosis is the common cause, not always the true one.** My site styling vanished after a two-word edit. The assistant's first answer was the statistically likely one: browser cache, hard-refresh. Reasonable — and wrong. When I said it happened in a fresh browser too, the actual investigation found the real cause: the GitHub Pages theme ships its own `assets/css/style.css`, mine sat at the same path, and an incremental rebuild let the theme's file overwrite it. The lesson isn't "AI is bad at debugging" — it's that the confident first answer is drawn from what's usually true, and you have to push it to *check* rather than *guess*. The fix only appeared once we compared the bytes actually being served against the file on disk.

**Knowing when to stop.** Copilot will confidently suggest solutions to problems it doesn't fully understand. Recognizing when a suggestion is "plausible-sounding but wrong" is a skill that takes practice. The more domain knowledge you have, the better you can catch this.

**Going in circles.** This is similar to the previous point in regards to copilot's behavior when working on problems it doesn't fully understand. I've had many cases where I have worked through roadblocks, one after another, only to find myself back at the beginning. Want to know what happens if you keep going? You keep going in circles! Knowing when to stop the insanity is another acquired skill.

**It can reconstruct *what*, never *why*.** An assistant reading my repos can tell you exactly how Vault is wired. It cannot tell you that I never ran a bake-off — that I picked Vault because I use it at work and wanted to understand it more deeply. That reasoning exists nowhere in the configs. The ADR drafts came back with explicit `TODO` markers wherever the reasoning was mine alone, and answering those was the actual work. Left unmarked, it would have invented a plausible evaluation I never performed — and a portfolio full of confident, fabricated rationale is worse than no portfolio.

**AI judging AI is a noisy instrument.** Building [Cortexa](../projects/cortexa/)'s evaluation harness taught me this the hard way. A single-pass LLM judge swung enough run-to-run that small differences were unreadable — I was measuring judge variance, not system quality. I added a blind judge, a median across multiple passes, and a fixed judge model, and trusted the result enough to publish it. It was still wrong: a model judging its own output inflated the scores, and a second judge wrote justifications that contradicted its own numbers. I retracted the result and replaced the judge with deterministic checks on the transcripts and my own blind preferences. If you're going to let a model grade something, treat the grader as an instrument that needs calibrating — and expect it to fail calibration.

### Pattern: Context-First Prompting

The most effective pattern I found: give Copilot the current state of the file *and* the goal before asking for changes. "Here's what the file looks like. Here's what I want it to do. What should change?" produces much better results than "refactor this."


### Pattern: Verify, Don't Trust

Treat Copilot output like a PR from a capable junior engineer who hasn't worked in your codebase before. Review it. Run it. Check the plan output. The value is in the speed of the first draft, not in blindly applying changes.


### Pattern: Make It Build the Verifier

The upgrade on "verify, don't trust": when a change is too large to eyeball, have the assistant write the check *as well as* the change. Restructuring the ADR files was fine; what made it safe was a script asserting that every filename, title, and permalink agreed, and that no link label pointed somewhere else. Same instinct as the link checker that runs before every push, and the same instinct behind Cortexa's evaluation harness.

There's a pattern across everything on this site: the AI-assisted work I trust most is the work where I also built the thing that would catch it being wrong. That generalises well beyond AI, but AI makes it urgent — a tool that produces plausible output at high speed needs a check that runs at the same speed.


### Pattern: Push Past the First Answer

The first response is drawn from what's usually true. For anything genuinely specific to your setup, treat it as a hypothesis, not a diagnosis. The prompt that consistently gets me somewhere: *"Don't guess — what could we measure that would distinguish these possibilities?"* That's the question that turned "clear your cache" into comparing served bytes against the file on disk, which found the real bug in about a minute.

</details>
