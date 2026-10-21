# Roadmap

Status of the work in [the runtime spec](arcade-runtime-spec.md), tracked
two ways: by **milestone** (§12, the acceptance view) and by **work
package** (§16.3, the execution view). A package may land before its
milestone is current; a milestone closes only when every package in its
row is merged and its acceptance row passes on `main`.

The integrator updates this file at every merge and milestone close. The
briefs live under [`work/`](work/README.md).

Status values: `todo`, `ready` (brief written, can be started),
`in progress` (branch exists), `review` (merge requested), `merged`,
`closed` (milestone accepted).

## v1.0.0

| Milestone | Packages | Status | Closed on |
| --------- | -------- | ------ | --------- |
| M0 Feasibility probe | inherited | closed | 2026-10-20 (parent project) |
| M1 Bridge, adapter, display, preload | W0, W1, W2, W3, W4, W5, W13a | in progress | |
| M2 Family build matrix | W14a–f | todo | |
| M3 Audio | W6 | merged, acceptance pending real build | |
| M4 Input and keyboard | W7 | todo | |
| M5 Gamepads | W8 | todo | |
| M6 Saves | W9 (storage half), W15 | todo | |
| M7 ROM supply and cabinet | W2 (romsets half), W9 (ROM store half), W10, W12, W13b | todo | |
| M8 BIOS and DIP switches | W16 | todo | |
| M9 v1.0.0 release gate | W17 | todo | |

## Post-1.0

| Milestone | Packages | Status |
| --------- | -------- | ------ |
| M10 Mobile: touch, mapper, portrait | not yet cut | todo |
| M11 Analog inputs | not yet cut | todo |
| M12 High-score bridge | not yet cut | todo |
| M13 Local compatibility matrix | not yet cut | todo |
| M14 Optional FBNeo probe | not yet cut | todo |
| M15 Optional `LibretroAdapter` | not yet cut | todo |
| M16 Pinned MAME upgrade probe | not yet cut | todo |
| M17 Deferred families | not yet cut | todo |

## Work packages

| ID | Package | Lane | Milestone | Status | Branch | Merged |
| -- | ------- | :--: | --------- | ------ | ------ | ------ |
| W0 | Contracts and doubles | T | M1 | merged | (integrator, on `main`) | 2026-10-20 `327a7a5` |
| W1 | Patch relocation and family target pairs | N | M1 | merged | `wp/w1-targets` | 2026-10-20 (merge of `7f99a0d`) |
| W2 | Build pipeline and romsets extraction | N | M1, M7 | todo | | |
| W3 | Production web bridge | N | M1 | in progress | `wp/w3-bridge` | |
| W4 | `MameEmulatorAdapter` | N | M1, M6 | ready (after W3) | `wp/w4-mame-adapter` | |
| W5 | `ArcadeDisplay` | T | M1 | merged | `wp/w5-arcade-display` | 2026-10-20 `5f8ae09` |
| W6 | `ArcadeAudio` | T | M3 | merged | `wp/w6-arcade-audio` | 2026-10-20 (merge of `d6ce5f4`) |
| W7 | `ArcadeInput`, `KeyboardSource`, controller config | T | M4 | merged | `wp/w7-arcade-input` | 2026-10-20 (merge of `6cecda2`) |
| W8 | `GamepadSource` | T | M5 | in progress | `wp/w8-gamepad-source` | |
| W9 | `ArcadeStorage`, `ArcadeRomStore` | T | M6, M7 | merged | `wp/w9-storage` | 2026-10-20 (merge of `aefb07c`) |
| W10 | `RomSetAudit`, `arcade-audit-roms` | T | M7 | merged | `wp/w10-romset-audit` | 2026-10-20 (merge of `5859c88`) |
| W11 | `ArcadePlayer` | T | M1–M4 | todo | | |
| W12 | `ArcadeCabinet` | T | M7 | todo | | |
| W13a | Harness: minimal preload page | T | M1 | todo | | |
| W13b | Harness: cabinet page | T | M7 | todo | | |
| W14a | Family `cps2` | N | M2 | todo | | |
| W14b | Family `namco-classic` | N | M2 | todo | | |
| W14c | Family `namco-s1` | N | M2 | todo | | |
| W14d | Family `namco-s2` | N | M2 | todo | | |
| W14e | Family `taito-classic` | N | M2 | todo | | |
| W14f | Family `taito-16` | N | M2 | todo | | |
| W15 | Saves bridge (memcard, EEPROM, F8) | N | M6 | todo | | |
| W16 | BIOS and DIP switches | N+T | M8 | todo | | |
| W17 | Release gate | T | M9 | todo | | |

## Log

Newest first. One line per merge, milestone close, or contract amendment.

- 2026-10-20 — W9 merged: `ArcadeStorage`, `ArcadeRomStore`; §10.7 snippet amended to show injected dependencies.
- 2026-10-20 — W6 merged: `ArcadeAudio`. W8 started.
- 2026-10-20 — Integration fix: browser test pages now use the shared `tests/support/TestPageServer.ts`, which resolves `fflate` for pages that import the root index (W10 exposed the gap).
- 2026-10-20 — W10 merged: `RomSetAudit`, `arcade-audit-roms`; §10.5 amended with `problems` and metadata shapes. W9 started.
- 2026-10-20 — W7 merged: `ArcadeInput`, `KeyboardSource`, `DEFAULT_KEYBOARD_MAP`, internal controller-config generator. W6 started.
- 2026-10-20 — W1 merged: probe patches relocated, neogeo/cps1/irem-m72 target pairs with complete lists, family-pair build mode; integrator follow-up repointed inherited tests and moved probe pre-JS. W3 started.
- 2026-10-20 — §4.3.1 contract amendment: JavaScript-facing module shape pinned for W3 and W4; W3 brief written.
- 2026-10-20 — W5 merged: `ArcadeDisplay` (`5f8ae09`); integrator follow-up added root exports and ImageData reuse.
- 2026-10-20 — W1 and W7 started on their branches by Codex agents.
- 2026-10-20 — §4.4 contract amendment: controller-config token table pinned for W3 and W7 (`153a821`).
- 2026-10-20 — W0 merged: shared contracts, `ArcadeRuntimeError`, test doubles (`327a7a5`).
- 2026-10-20 — Fork from `mame-game-runtime-ts`; M0 inherited closed.
