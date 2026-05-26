# Skills & Local Runtime — what exists and how to test it

Concise map of the hardware classifier, quant selector, runtime abstraction,
skill executor (dry-run / approval / trust / report), VM testing, and the two
example skills — plus exactly what is covered by automated tests vs. what you
must validate on your real machine.

---

## 1. Hardware classifier

- `src-tauri/src/services/hardware.rs` — generic `HardwareProfile` (RAM/VRAM/swap)
  + model-fit math. Pure parsers: `parse_meminfo`, `parse_rocm_smi_vram`,
  `parse_parameter_count`, `estimate_weight_bytes`, `estimate_runtime_bytes`.
  `RAM_HEADROOM_BYTES = 1.5 GB` is always reserved for the user.
- `src-tauri/src/services/local_engine/hardware_profiler.rs` — richer
  `HardwareSnapshot` (CPU, disks, GPUs via `/sys/class/drm`, accelerators).
  Reuses the pure parsers above (no duplication).

Honest by design: a missing source yields `Unknown`/`None` + a note, never a
fabricated value. A 16 GB RX 7600 box is tagged `MediumPc + LowRamPc + AmdPc`,
never `Server`/`HighRamPc`; `AmdRocmPc` only when ROCm is actually `Healthy`.

## 2. Quant selector

`hardware.rs::quant_presets()` — four simple presets, advanced = any quant
string parsed by `model_profiler::bpw_from_quant`:

| Preset      | Ollama quant | bits/weight |
|-------------|--------------|-------------|
| Qualidade   | Q8_0 (Q6_K)  | 8.5         |
| Equilíbrio  | Q5_K_M       | 5.67        |
| Velocidade  | Q4_K_M       | 4.83        |
| Extremo     | Q2_K         | 3.35        |

## 3. Runtime abstraction

`local_engine/runtime_selector.rs` scores backends; `backends/` detects them.
AMD priority: **Vulkan first**, **ROCm/HIP only if `Healthy`** (not merely
present), then Ollama, then CPU. Cloud is a last-resort fallback and is **never
marked ready** without a configured+tested provider (`BackendAvailability::Unknown`).
llama.cpp GPU variants are `Installed` (capability unconfirmed), never `Ready`,
never auto-compiled.

## 4. Skill executor

`src-tauri/src/services/skills.rs`:
- **Dry-run mandatory**: `build_plan` rejects any script without `--dry-run`.
- **Approval = click + fala**: every plan carries a `spoken_summary`; nothing
  auto-approves. Real execution always requires explicit approval.
- **Trust**: `mark_trusted` records an FNV-1a script fingerprint; `is_trust_valid`
  invalidates trust the moment the script bytes change.
- **Report**: `SkillVmReport` (outcome, exit code, stdout/stderr tails, steps,
  alternatives) — no raw shell, stack traces, or keys leak to the UI.
- **Kind gating**: `derive_kind` → software (file/package/git) vs hardware
  (audio/bluetooth/gpu/network). `is_vm_testable` = software only.

## 5. VM testing + snapshot/rollback (software skills only)

`run_skill_in_vm`: snapshot → run → evaluate → **auto rollback** on any non-zero
exit, non-empty stderr, or failed functional check (`should_rollback`). Backed
by `VirshVmRunner` (virsh snapshots + script piped over SSH). Hardware skills
can never reach this path — `test_skill_in_vm` rejects them before touching the
VM.

## 6 & 7. Example skills (plain-text, versioned, under `skills/`)

- `repair-audio.{sh,json}` — restarts the user PipeWire stack (audio, medium).
- `repair-bluetooth.{sh,json}` — rfkill unblock → restart `bluetooth.service` →
  power on controller (bluetooth, medium).

Both: mandatory `--dry-run`, clear human report, reject unknown args (exit 64),
deterministic (fixed service lists, no installs). Both are **hardware** →
ManualDryRun → never VM-tested, require manual host approval, and state plainly
that the real device cannot be VM-validated and that there is **no full snapshot
rollback for hardware**.

## 8. Critical tests

- `skills.rs` (12 tests): dry-run rejection, kind gating, manual-approval for
  hardware, arg shell-quoting, rollback triggers, fingerprint stability, virsh
  arg building, VM pass / rollback-on-error / rollback-on-runner-failure, and
  `repo_hardware_skills_require_manual_approval` (loads both real skill files).
- `local_engine/*` (26 tests): size classes, fit classification, AMD Vulkan-first,
  ROCm-excluded-unless-healthy, cloud honesty, presets round-trip, parsers.

---

## What was validated *here* (in the container)

| Check | Command | Result |
|-------|---------|--------|
| Skill scripts syntax | `bash -n skills/*.sh` | pass |
| Skill dry-runs | `bash skills/repair-audio.sh --dry-run` etc. | exit 0, report printed |
| Manifests | JSON parse | valid |
| Skills logic | `skillcheck` harness | 12/12 |
| Local Engine logic | `engcheck` harness | 26/26 |
| Rust formatting | `cd src-tauri && cargo fmt --check` | clean |
| Frontend | `npm run lint && npm run typecheck && npm test -- --run && npm run build` | 102/102, build ok |

> The full Tauri crate **cannot** `cargo check`/`cargo test` here — it needs
> GTK/webkit2gtk system libraries that aren't installable in this container.
> The `engcheck`/`skillcheck` harnesses compile the real module files in
> isolation, which is strong but not identical to a full crate build.

## What you must validate on your real machine

Run these locally (Arch + RX 7600 + 16 GB):

```bash
# 1. Full Rust build & tests (needs GTK/webkit installed)
cd src-tauri
cargo fmt --check
cargo check
cargo test            # confirms the RiskLevel Copy/Eq fix compiles crate-wide

# 2. Hardware/accelerator detection (the app reads these)
vulkaninfo --summary  # Vulkan should be Present/Healthy on RX 7600
rocm-smi              # only then should the app surface ROCm as Healthy
cat /proc/meminfo     # 16 GB total expected
ls /sys/class/drm/    # cardN should expose the AMD GPU (vendor 0x1002)

# 3. Skills — dry-run first (safe, mutates nothing)
bash skills/repair-audio.sh --dry-run
bash skills/repair-bluetooth.sh --dry-run

# 4. Skills — real run ONLY via the app's click + fala approval flow.
#    repair-audio runs:    systemctl --user restart pipewire pipewire-pulse wireplumber
#    repair-bluetooth runs: sudo rfkill unblock bluetooth; sudo systemctl restart bluetooth.service; bluetoothctl power on
#    These touch real hardware and have NO full rollback — approve deliberately.

# 5. Software-skill VM testing (libvirt) — set up a throwaway Arch VM:
sudo pacman -S libvirt qemu-base openssh
# create/boot an Arch guest, enable sshd, note its IP, then in the app call
# "test in VM" with: domain=<libvirt-domain>  ssh_target=root@<vm-ip>
# The executor will: snapshot -> run the (software) skill -> auto rollback on error.
virsh list --all                         # confirm your domain name
virsh snapshot-list --domain <domain>    # confirm snapshots work
```

### Cannot be tested in a VM (explained in each skill's report)
- **repair-audio**: no audio devices exist in a libvirt guest.
- **repair-bluetooth**: no physical Bluetooth radio exists in a libvirt guest.
- **ROCm/Vulkan GPU paths**: require the real RX 7600; the container has no GPU.

Both hardware skills print these limitations in their dry-run report, so the
approval screen tells you exactly what could not be pre-validated.
