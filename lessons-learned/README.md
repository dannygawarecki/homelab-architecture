# Lessons Learned

Real operational experience from running this platform. Not polished postmortems — honest notes on what broke, what I underestimated, and what I'd do differently.

This cluster has been rebuilt from scratch three times. I lost data once. Each rebuild left the platform in a better state than it was before — but they weren't planned improvements. They were recoveries. That's the most useful kind of learning.

---

## The k0s → Talos Migration

I started on bare-metal k0s with servers treated as pets. That worked until it didn't. The core problem: when something went wrong at the OS level, the answer was always "log in and fix it." That's fine until you're three layers deep into a workaround and you can't remember what the original state was supposed to look like.

I also fought hard to get GPU passthrough working into containers on k0s. That battle is over — I lost it completely. The combination of container runtime, kernel driver, and k0s networking never came together in a way that was stable.

Moving to Talos + Proxmox VMs changed the mental model entirely. Nodes are disposable. If something is wrong at the OS level, you don't fix it — you rebuild it. GPU passthrough on Talos worked on the first serious attempt.

**Lesson:** Treat your nodes as cattle from the start. The discipline of keeping everything declarative and reproducible pays back every time something breaks.

---

## Cilium + Istio CNI Coexistence

Running two CNI-adjacent components on the same node requires careful ordering and configuration. Cilium's eBPF kube-proxy replacement and Istio's traffic interception both operate at the network layer. Getting them to coexist without one clobbering the other's routing rules took iteration — specifically around Cilium's `kubeProxyReplacement` settings and Istio's `cni.chained` mode.

**Lesson:** Read both projects' docs on CNI chaining before assuming they'll "just work." Test with a minimal workload before rolling out across the cluster.

---

## Terraform State and Provider Drift

The `bpg/proxmox` Terraform provider sometimes generates plan diffs for resources that haven't actually changed — particularly around `cdrom` blocks and `boot_order`. This caused noisy plans where Terraform wanted to "add" a CD-ROM drive that Proxmox already had or remove boot order entries that existed in state but not config.

**Lesson:** When you see recurring plan noise, check whether it's config drift (fix the config to match state) or provider normalization behavior (add `lifecycle.ignore_changes` or remove the unmanaged attribute). Don't blindly apply noisy plans.

---

## Secrets Sprawl Before Vault

Early on, some secrets were managed ad-hoc — in Kubernetes Secrets created manually, in ArgoCD's credential store, or hardcoded in values files. Retrofitting everything through External Secrets Operator and Vault required hunting down every secret reference.

**Lesson:** Establish the secrets management pattern (ESO + Vault) before deploying the first workload, not after. Retrofitting is painful.

---

## Networking Deeper Than Expected

I expected to configure VLANs and move on. Instead, VLANs pulled me into MTU sizing, VLAN trunk configurations on Unifi switches, corosync heartbeat traffic isolation, and eventually Cilium egress policies. Each change that "should have been simple" had a dependency I hadn't accounted for.

The MTU issues were the worst. A misconfigured MTU silently degrades performance and causes intermittent failures that don't point at themselves. Traffic flows, but large packets get fragmented or dropped, and the symptoms look like application bugs, not network bugs.

**Lesson:** When you hit intermittent failures that don't reproduce consistently — especially after a network change — check MTUs before anything else. And document your VLAN/MTU decisions as you make them, not after.

---

## GPU Passthrough Chain Complexity

Getting GPU passthrough working end-to-end (Proxmox PCIe passthrough → Talos Linux → NVIDIA device plugin → Kubernetes pod scheduling → Ollama) involves more moving parts than it looks:

- Proxmox host IOMMU configuration
- Talos custom image with NVIDIA kernel extensions
- NVIDIA device plugin DaemonSet configuration
- Pod resource requests (`nvidia.com/gpu: 1`)
- Ollama model loading behavior with limited VRAM

Each layer can fail silently in ways that look like the next layer's problem.

**Lesson:** Test each layer independently before stacking them. Validate IOMMU groups before assuming passthrough will work. Check `talosctl dmesg` for kernel-level GPU detection before debugging at the Kubernetes layer.

---

## UptimeKuma Monitor Management

Starting with one-resource-per-monitor in Terraform created a lot of boilerplate. Refactoring to a `for_each` pattern driven by a `locals` map reduced the file from ~150 lines to ~70 and made adding new monitors trivial.

**Lesson:** When you find yourself copy-pasting a Terraform resource block more than twice, stop and reach for `for_each` with a locals map. The upfront investment pays back immediately.
