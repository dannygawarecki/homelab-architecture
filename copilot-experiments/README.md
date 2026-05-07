# Copilot & AI-Assisted Engineering

Notes on using GitHub Copilot (and Claude via Copilot Chat) to accelerate infrastructure work on this platform. Not a sales pitch — an honest account of where it added leverage and where it didn't.

AI has genuinely sped up both my progress and my learning on this project. It has also set me back a few times — by confidently assuring me that a destructive action would be fine, or by assembling plausible-looking solutions from outdated pieces that didn't quite fit together.

I've settled into a rhythm. I've learned what AI tools are good at and how to use them effectively. The short version: they're great at troubleshooting an existing, known system. They're good at coding patterns and boilerplate. When you're trying to assemble the most recent version of several moving parts into something that works, you have to be careful — and you have to trust your gut when something feels wrong.

---

## Where It Helped

**Terraform refactoring.** Turning six copy-pasted `uptimekuma_monitor_http` resources into a single `for_each`-driven resource with a `locals` map was a 30-second conversation rather than a 10-minute manual edit. Copilot understood the pattern, generated idiomatic HCL, and got the conditional `accepted_status_codes` logic right on the first try. And then it scaled up from 6 to 47 almost instantly.

**Debugging container issues.** Given the failure context and a description of what the container should be doing, Copilot is very good at identifying the root of an issue. The pattern that works: supply the relevant logs, describe what you expected, and ask what's wrong — not "fix this" necessarily, but "what does this tell you?" This produced accurate diagnoses for issues ranging from Hermes agent misconfiguration to failed iSCSI mounts. The key is that Copilot is reasoning about known software behaving in a known way; when it's a configuration interaction specific to your setup, you still have to supply that context explicitly.

**Generating boilerplate.** ArgoCD Application manifests, Kustomization stubs, and Helm values files all follow predictable patterns. Copilot generates working first drafts that need light editing rather than blank-page starts. It's especially powerful when following a pattern that already exists somewhere else in the ecosystem.

**Creating this wiki.** This entire architecture repo was built collaboratively with Copilot. I provided the raw material — the repos, the diagrams, the story of how the platform evolved — and Copilot helped structure it into something coherent. The ADRs were a back-and-forth: I described a decision and the tradeoffs I remembered living through, and Copilot shaped them into the format and filled in reasoning I had internalized but not articulated. The result reads like something I wrote, which is the point — it reflects real decisions made for real reasons, not generated fluff. The practical lesson: AI is very good at helping you externalise what you already know.

---

## Where It Struggled

**Provider-specific edge cases.** Copilot's training data for newer Terraform providers (bpg/proxmox, breml/uptimekuma) is sparse. It sometimes generated resource schemas that were slightly wrong — using attribute names that didn't exist or missing required fields. Always validate against the provider docs.

**Cluster-specific context.** Copilot doesn't know your cluster. When debugging something that requires understanding how Cilium, Istio, and Talos interact on your specific nodes, it gives generic answers. You have to supply the context. MCP and CLI access has been a big help in this area!

**Assembling cutting-edge stacks.** When you're putting together components that are individually well-documented but rarely combined — say, Talos + Cilium + Istio ambient mode + GPU passthrough — the AI is working from training data that may predate the current versions or miss the interaction-specific gotchas. This is where it has cost me time.

**Confidently wrong about destructive actions.** The most dangerous failure mode: Copilot assures you that something is safe when it isn't. I've had moments where I trusted that assurance and instantly regretted it. The solution isn't to stop using AI — it's to treat irreversible actions as requiring your own independent verification, regardless of how confident the suggestion sounds.

**Knowing when to stop.** Copilot will confidently suggest solutions to problems it doesn't fully understand. Recognizing when a suggestion is "plausible-sounding but wrong" is a skill that takes practice. The more domain knowledge you have, the better you can catch this.

**Going in circles.** This is similar to the previous point in regards to copilot's behavior when working on problems it doesn't fully understand. I've had many cases where I have worked through roadblocks, one after another, only to find myself back at the beginning. Want to know what happens if you keep going? You keep going in circles! Knowing when to stop the insanity is another acquired skill.

---

## Pattern: Context-First Prompting

The most effective pattern I found: give Copilot the current state of the file *and* the goal before asking for changes. "Here's what the file looks like. Here's what I want it to do. What should change?" produces much better results than "refactor this."

---

## Pattern: Verify, Don't Trust

Treat Copilot output like a PR from a capable junior engineer who hasn't worked in your codebase before. Review it. Run it. Check the plan output. The value is in the speed of the first draft, not in blindly applying changes.
