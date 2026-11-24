---
title: Four Copies, One Medium
eyebrow: Writing
description: My backup design had four layers and a decision record that called them independent. A stalling disk array proved three of them were the same copy — and the alert that should have told me couldn't start, because it was on the array too.
permalink: /writing/four-copies-one-medium/
---

Here is the sentence this whole thing turned out to be about. I wrote it myself, over a year ago, in the tradeoffs section of my own decision record:

> **MinIO is a shared dependency for three of four layers.** Velero, WAL archives, and dumps all land in in-cluster MinIO on Synology-backed storage — which concentrates risk in the NAS.

Four rows in a table under the heading **Four independent layers**. One paragraph further down admitting that three of them weren't. Both written by me, on the same afternoon, and I never felt the contradiction until a disk array started stalling.

---

## What August 24 actually looked like

A LUN on the Synology stopped responding cleanly. Not a failed array — a *stalling* one, which is worse, because nothing declares itself.

MinIO's volume sat on that LUN. MinIO went down. Every backup that writes to MinIO failed: the CloudNativePG WAL archive, the nightly logical dumps, Velero's metadata. Three of my four layers, gone in one event, exactly as the tradeoffs paragraph said they would be.

Then the part I didn't predict.

The alert never fired. Not "fired late" — **never started**. The CronJob that exists specifically to tell me a backup didn't happen mounts a volume from the same storage, and its mount timed out. The pod sat in `ContainerCreating` while the thing it was built to report on was actively failing.

I had written, in that same ADR: *"A backup that isn't checked is a hope, not a backup."* The checker was on the array.

<div class="callout" markdown="0">
  <h3>The thesis</h3>
  <p>Independence isn't something you get by <em>counting</em> layers. It's a property you have to prove, and the proof is always the same question: name the thing that, if it dies, takes more than one of them with it.</p>
  <p>I had four backups. I had one medium. And I'd written that down a year earlier, which turns out to be a completely different act from handling it.</p>
</div>

## Writing a risk down is not mitigating it

This is the part I'd rather skip and won't.

The gap wasn't knowledge. ADR 012 named the shared dependency, named the NAS as a single point of failure, and closed with a line about there being no offsite layer yet — *"A fire is unhandled. This is the known, honest gap in the design."*

Every word of that was correct. It sat there for a year, and the honesty of it was doing something I didn't intend: **a named risk feels handled.** It's in the document. It's been considered. There's a plan. The discomfort that should have driven the work got spent on writing the paragraph instead.

> A tradeoffs section is where the real architecture lives. Mine had the answer in it, in my own words, and the document being honest is what made it comfortable to leave alone.

What changed my mind wasn't new information. It was watching the failure mode run about forty percent of the way and stop on its own.

## The rule I actually operate by

I self-host almost everything. Kubernetes on my own hardware, my own git server, my own registry, my own Postgres, my own identity provider, my own model inference. That's the point of the lab and I'm not walking it back.

But the August incident made a line visible that I'd been crossing by feel:

> **Self-host everything that can live inside the house. Pay for the things that have to survive the house.**

That's not a philosophy about ownership, and it isn't a cost argument. It's a question about failure domains, and I already had two answers to it before I noticed it was one question:

| Service | What it sits outside of | Why that's the whole point |
|---|---|---|
| **Backblaze B2** | The building, the array, the cluster | The copy that exists when the storage doesn't |
| **Tailscale** | My own network path and firewall | I can still get in when the thing that's broken is the way in |
| **Cloudflare** | My residential IP and inbound ports | A public front door that isn't a hole in my house |

Each one is something I *could* self-host, and each one would then sit inside exactly the blast radius it exists to be outside of. A backup target in the basement, a VPN endpoint behind the firewall I'm trying to reach through, a reverse proxy on the IP I'd rather not publish — those aren't cheaper versions of the same thing. They're the same failure domain wearing a different label.

Three paid services, all in the free or near-free tier. Every one is a dependency I took on deliberately, and the thing I'm buying is *distance*.

## What goes offsite, and the longer list of what doesn't

The interesting work wasn't the upload. It was deciding what not to send.

**Offsite, daily:** the logical dump of every database, Terraform state for both repos, Vault raft snapshots, the search index. **Offsite, weekly:** about 6 GB of volume data across 13 namespaces, four restore points deep.

**Deliberately not offsite:**

- **The WAL archive and base backups.** Twenty gigabytes, churning daily, and they only restore into a matching CloudNativePG cluster. Point-in-time recovery answers *"the database was corrupted at 14:02."* Offsite answers *"the array is gone."* Those are different disasters, and paying to ship the first one's data to the second one's destination buys nothing. Losing up to a day there is the accepted outcome — written down, on purpose.
- **Velero's metadata bucket.** Its backups point at snapshots that live on the NAS. Offsite, it restores nothing that isn't already in git.
- **The container registry.** 2.9 GB of the 3.0 GB Gitea volume, and every image in it is rebuilt by CI from a Dockerfile that *is* in git. The repositories themselves are 64 MB. So the registry moved onto its own volume purely so the backup could exclude it. After a restore it comes back empty and refills on each project's next build.

That last one is the pattern in miniature: **the question isn't "is this data valuable," it's "what is the cheapest path back to it."** For the registry, the cheapest path is a build. Shipping it offsite would have been paying to preserve something I can regenerate for free.

## Two things that would have hurt me later

**The bill is in the versions, not the files.** Backblaze charges for every version it holds, hidden ones included, and the bucket keeps hidden versions for 30 days. My on-site dump window is 14 days. Mirror that naively and the steady state isn't 14 days of dumps — it's 44, because each expired dump hangs around hidden for another 30. Measured out: 8.6 GB of dumps against a 10 GB free tier that already held 6 GB of volume data.

The fix was to stop treating the offsite copy as a mirror of the on-site one. Offsite holds seven days, with a lifecycle rule expiring hidden versions after seven more — 2.7 GB. On-site keeps its full window. They're different layers answering different questions, so there was never a reason for them to hold the same thing.

There's a guard behind it that fails the sync job above 5 GiB and pages me. It deliberately runs *after* the mirror, so an overrun costs a notification, never a skipped backup.

**The key that can't delete.** The credential for the mirror has list, read and write — no delete. That sounds like it would break `rclone sync`, and it doesn't, because deleting a file on B2 *hides* it by default, and hiding only needs write. So the sync still mirrors removals, and a stolen key still can't destroy history. Thirty days of hidden versions is the margin, and the only thing in the system that ever truly deletes is a lifecycle rule.

I like this one because it cost nothing. It's the same capability, spelled more carefully.

## The dependency I nearly shipped

Buried in "what restoring needs that isn't in the bucket," and the reason that section exists at all:

The Vault raft snapshots are encrypted with a key wrapped by a transit engine on a separate host. Restoring into a brand-new Vault — the case where the cluster and that host are both gone, which is the *only* case this bucket is for — requires the recovery keys.

And the Backblaze account credentials, the ones that let me reach the bucket in the first place, were stored in Vault.

**To restore Vault I needed the bucket. To reach the bucket I needed Vault.** Nothing about that loop announced itself; every individual piece was stored correctly. It only becomes visible if you write down the restore procedure in order, from the position of having nothing — which is a different exercise from building the backup.

The fix is boring and lives outside every system described here. The lesson isn't: a backup design has to be validated *backwards*, from the empty-handed end, because that's the only direction that finds a cycle.

## Three days of the platform saying no

Worth recording, because "put some files in a bucket" sounds like an afternoon:

- Velero sat `Unavailable` with every connection dropped, while DNS resolved fine. Cilium's `*` in a DNS policy matches **exactly one label**, so `*.backblazeb2.com` matched the API host and never matched `s3.us-east-005.backblazeb2.com`. My comment in the policy claimed it covered both. The comment was wrong, and a wrong comment is how a policy gap survives its own review.
- The first weekly backup uploaded all 31 volumes — 5.98 GiB, every one `Completed` — and then failed on the last small metadata write, because the AWS plugin sends an empty `x-amz-tagging` header that B2 rejects. A failure that only appears after everything expensive has already succeeded.
- The build day hit 2,563 Class C API calls against a default daily cap of 2,500. Velero polls a backup location every minute by default. That location receives one backup a week. It polls hourly now, and the call count went from ~2,900 a day to about 50.

None of those were Backblaze being difficult. All three were defaults that are correct for one endpoint and wrong for another.

## And then I restored something

The honest closing line of ADR 012, for a year, was that I'd exercised every layer in pieces and never rehearsed the whole thing in one sitting. *"That's the honest difference between 'I have backups' and 'I have a tested recovery.'"*

So: today's Gitea dump, pulled out of Backblaze onto my workstation, restored into a throwaway `postgres:18` container in local Docker, and compared against the live database. The point of doing it in Docker rather than in the cluster is that **nothing from the cluster is in the data path.** If the platform were gone, this is the procedure, and none of it would notice.

| Check | Result |
|---|---|
| Dumps present in the bucket | 7 — exactly the seven-day window |
| Downloaded file's SHA-1 vs. the one B2 recorded at upload | match |
| `pg_restore` with stop-on-first-error | exit 0, 1,166 entries, 4 seconds |
| Tables, repositories, users | 116, 17, 4 — identical to live |
| Issues, action runs, commit statuses | slightly below live |
| Newest repository update in the restored copy | 01:59:07 UTC |

The two rows that don't match are the two that prove it's real. The dump runs at 02:00 UTC and I did this eighteen hours later, so the restored copy is *behind* live on exactly the tables that take writes, and its newest repository timestamp is 01:59:07 — sixty-three seconds before the dump started. A copy that matched live perfectly would have meant I was somehow reading live.

It also crossed a minor version on the way: 18.4 in the cluster, 18.6 in the container. ADR 012 claims these dumps "restore into *any* Postgres anywhere — the escape hatch if every platform-specific tool fails." That was an assertion for a year. It's now a thing I've watched happen.

Then the drill did the one thing I actually needed it to.

**My Vault token had expired.** The Backblaze read key lives in Vault, so the obvious next move was the convenient one: the same key is synced into the cluster as a Kubernetes secret for the sync job, and I have cluster access, so I pulled it from there and carried on.

It worked. It also meant the drill I'd just run to prove I could recover without the cluster had quietly reached into the cluster for its first step.

> I built the offsite copy specifically so that it would survive the platform, then reached into the platform for the credential, because that path was open and I was mid-task. The failure domain I'd spent three days getting out of was still the most convenient place to get something from.

Nothing was wrong with the result — the bytes came from Backblaze and the restore is real. But in the disaster this bucket exists for, neither Vault nor the cluster is there, and the key comes from the Backblaze console, using account credentials that live with the recovery keys, outside all of it. The procedure in the runbook now says that explicitly, because I've now demonstrated that the convenient path is the one you'll take at the moment you're least able to afford it.

That's the same lesson as the circular dependency, and the same lesson as the alert on the stalling array, arriving for the third time in one project. **Things inside the blast radius are always easier to reach. That's what makes them so hard to stop depending on.**

One path of three is now drilled. The Vault raft snapshot, a Velero restore out of the Backblaze location, and a full-size database rather than a small one are all still claims, and they're listed as such in the runbook's new drill log, which is where the next honest version of this sentence gets written.

The drill is the only part of this that makes the previous three thousand words mean anything. Everything above it was a claim. This is the one thing on the page that was *checked*.

---

*The decision record this corrects — including the tradeoffs paragraph that was right the whole time: [ADR 012 — A Layered Backup Strategy](../../architecture/decisions/012-layered-backup-strategy/). The storage single point of failure it accepts: [ADR 005](../../architecture/decisions/005-synology-iscsi-storage/). The other thing I pay for so that it's outside the house: [ADR 015 — Tailscale](../../architecture/decisions/015-tailscale-remote-access/).*
