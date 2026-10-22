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
| M1 Bridge, adapter, display, preload | W0, W1, W2, W3, W4, W5, W13a | closed | 2026-10-20 |
| M2 Family build matrix | W14a–f | closed for v1.0.0 (2026-10-21): all six merged; F4–F6 measured for neogeo, namco-classic, irem-m72, taito-16; cps1 and cps2 measured after the QSound placeholder ROM patch 0004; namco-s1, namco-s2 and taito-classic deferred from v1.0.0 on 2026-10-21 (built and gated, no lawful set to measure) | |
| M3 Audio | W6 | closed (Neo Geo and Namco WSG titles; a CPS title awaits the 0.161 qsound.zip) | 2026-10-20 |
| M4 Input and keyboard | W7 | closed (one title per measured family; a zero-button title awaits a lawful set, the vocabulary and generator cover it in spec tests) | 2026-10-20 |
| M5 Gamepads | W8 | closed (Neo Geo four-button title with scripted standard pads; CPS-1/CPS-2 two- and three-button titles pass; a six-button CPS-2 title is deferred to M18) | 2026-10-20 |
| M6 Saves | W9 (storage half), W15 | closed (2026-10-21): memory card verified, states persist, CPS-2 EEPROM written mid-run by `web_flush_nvram` | 2026-10-21 |
| M7 ROM supply and cabinet | W2 (romsets half), W9 (ROM store half), W10, W12, W13b | closed (picker path with synthetic archives and the real cabinet; preload path with the real build; audit agrees with MAME on every lawful local set) | 2026-10-20 |
| M8 BIOS and DIP switches | W16 | done | 2026-10-21: `35-dip-switches.test.ts` against the namco-classic build; a BIOS option is exercised by the Neo Geo acceptance (`-bios`). |
| M21 Family wave 2 | W19a–g | all seven merged 2026-10-21; F4–F6 and acceptance measured by the integrator (agents' sandbox cannot run Chromium): `sega-16`, `midway-mcr`, `konami-16`, `atari-classic`, `misc-16`, `taito-f3` new; `irem-m72` gains M92 and `taito-16` gains Z System. Decided 2026-10-21 to land before the 1.0.0 commit | |
| M9 v1.0.0 release gate | W17 | final verification run passed 2026-10-21 | Fresh `--all --fresh` rebuild of nine families, `npm run check`, 504 spec cases, gated browser runs (M1, F4–F6 and M3–M5 for all five required families, DIP and selector tests) all green on commit `d09f540`; closing needs the §14.1 desktop walkthrough by the release owner and the version bump commit. |

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
| M19 Harness library view (W18) | W18 | merged 2026-10-21: drop-first identification, per-game start, folded settings; test 38 added |
| M22 Coin hold length on the Atari vector board | not yet cut | todo: the acceptance test's 120 ms keyboard coin did not register on the 41 Hz vector title while the 200 ms pad coin did; find the board's coin debounce and either lengthen the test's hold or document a minimum press |
| M20 Audio queue depth under load | not yet cut | todo: the 20 ms dry-restart lead gives zero dropouts on an idle desktop but 35 dropouts in 20 s with every core busy (measured 2026-10-21); a deeper lead needs the 120 ms cap to exclude scheduled lead, or it drops frames instead. The pinned-queue bug behind the sustained garble is fixed (see 2026-10-21 log); what remains is the one-off gap plus trim that each stall still costs |
| M17 Deferred families | not yet cut | todo: namco-s1, namco-s2, taito-classic F4–F6 once a lawful set exists (§4.6) |
| M18 Six-button CPS-2 acceptance | not yet cut | todo: keyboard binds P1 buttons 1–6 and `GamepadSource` forwards six action buttons, so such titles are expected to play; the measured §14.1 flow-4 run awaits a lawful six-button parent set (deferred 2026-10-21) |

## Work packages

| ID | Package | Lane | Milestone | Status | Branch | Merged |
| -- | ------- | :--: | --------- | ------ | ------ | ------ |
| W0 | Contracts and doubles | T | M1 | merged | (integrator, on `main`) | 2026-10-20 `327a7a5` |
| W1 | Patch relocation and family target pairs | N | M1 | merged | `wp/w1-targets` | 2026-10-20 (merge of `7f99a0d`) |
| W2 | Build pipeline and romsets extraction | N | M1, M7 | merged | `wp/w2-build-pipeline` | 2026-10-20 |
| W3 | Production web bridge | N | M1 | merged | `wp/w3-bridge` | 2026-10-20 (merge of `c4d6c12`) |
| W4 | `MameEmulatorAdapter` | N | M1, M6 | merged | `wp/w4-mame-adapter` | 2026-10-20 (merge of `f1c3653`) |
| W5 | `ArcadeDisplay` | T | M1 | merged | `wp/w5-arcade-display` | 2026-10-20 `5f8ae09` |
| W6 | `ArcadeAudio` | T | M3 | merged | `wp/w6-arcade-audio` | 2026-10-20 (merge of `d6ce5f4`) |
| W7 | `ArcadeInput`, `KeyboardSource`, controller config | T | M4 | merged | `wp/w7-arcade-input` | 2026-10-20 (merge of `6cecda2`) |
| W8 | `GamepadSource` | T | M5 | merged | `wp/w8-gamepad-source` | 2026-10-20 (merge of `e0d67ff`) |
| W9 | `ArcadeStorage`, `ArcadeRomStore` | T | M6, M7 | merged | `wp/w9-storage` | 2026-10-20 (merge of `aefb07c`) |
| W10 | `RomSetAudit`, `arcade-audit-roms` | T | M7 | merged | `wp/w10-romset-audit` | 2026-10-20 (merge of `5859c88`) |
| W11 | `ArcadePlayer` | T | M1–M4 | merged | `wp/w11-arcade-player` | 2026-10-20 (merge of `aa9c9b0`) |
| W12 | `ArcadeCabinet` | T | M7 | merged | `wp/w12-arcade-cabinet` | 2026-10-20 (merge of `07caa9a`) |
| W13a | Harness: minimal preload page | T | M1 | merged | `wp/w13a-harness-preload` | 2026-10-20 (merge of `2dab339`) |
| W13b | Harness: cabinet page | T | M7 | merged | `wp/w13b-harness-cabinet` | 2026-10-20 (merge of `0fbda6a`) |
| W14a | Family `cps2` | N | M2 | merged (F4–F6 pending private set) | `wp/w14a-cps2` | 2026-10-20 (merge of `d0c0c05`) |
| W14b | Family `namco-classic` | N | M2 | merged (F4–F6 pending private set) | `wp/w14b-namco-classic` | 2026-10-20 (merge of `5653b31`) |
| W14c | Family `namco-s1` | N | M2 | merged (F4–F6 pending private set) | `wp/w14c-namco-s1` | 2026-10-20 (merge of `a2c9046`) |
| W14d | Family `namco-s2` | N | M2 | in progress | `wp/w14d-namco-s2` | |
| W14e | Family `taito-classic` | N | M2 | merged (F4–F6 pending private set) | `wp/w14e-taito-classic` | 2026-10-20 (merge of `79aea64`) |
| W14f | Family `taito-16` | N | M2 | ready | `wp/w14f-taito-16` | |
| W15 | Saves bridge (memcard, EEPROM, F8) | N | M6 | merged (CPS-2 EEPROM runtime check done 2026-10-21) | `wp/w15-saves-bridge` | 2026-10-20 (merge of `6f0a252`) |
| W13c | Harness: BIOS and DIP selectors | T | M8 | merged | `wp/w13c-harness-selectors` | `6cf1dea` |
| W16 | BIOS and DIP switches | N+T | M8 | merged | `wp/w16-bios-dip` | `d5446ad` |
| W17 | Release gate | T | M9 | merged | `wp/w17-release-gate` | 2026-10-21 |
| W18 | Harness library view | T | M19 | merged | `wp/w18-harness-library` | 2026-10-21 (merge `04015f0`) |
| W19a | `sega-16` family | N | M21 | merged | `wp/w19a-sega-16` | 2026-10-21 (merge `694b180`) |
| W19b | `midway-mcr` family | N | M21 | merged | `wp/w19b-midway-mcr` | 2026-10-21 (merge `bce4b28`) |
| W19c | `konami-16` family | N | M21 | merged | `wp/w19c-konami-16` | 2026-10-21 (merge `5acdec3`) |
| W19d | `atari-classic` family | N | M21 | merged | `wp/w19d-atari-classic` | 2026-10-21 (merge `4286ad2`) |
| W19e | `misc-16` family | N | M21 | merged | `wp/w19e-misc-16` | 2026-10-21 (merge `ec77bb6`) |
| W19f | `irem-m72` + M92, `taito-16` + Z System | N | M21 | merged | `wp/w19f-irem-taito-ext` | 2026-10-21 (merge `827654c`) |
| W19g | `taito-f3` family | N | M21 | merged | `wp/w19g-taito-f3` | 2026-10-21 (merge `abf623a`) |

## Log

- 2026-10-22 — F4–F6 and M3–M5 measured on the host for every W19 family (twenty titles over eight records); all within the 1 % cadence and 2 % sustained gates on a quiet host. One open item: the 41 Hz Atari vector title's keyboard coin at the acceptance test's 120 ms hold did not register (pad coin at 200 ms did); noted in the record, tracked as M22.
- 2026-10-21 — W19a–g merged (seven packages in one afternoon, three agents at a time). Agent findings: the sandbox cannot bind loopback or start Chromium, so every F4–F6 record was measured by the integrator; the toolchain's bundled Node 8 rejects the agent runner's stdio, worked around with an untracked `BASH_ENV`; `taito-f3`'s bulk `-listxml` runs out of heap (64 MiB Ensoniq DRAM per configuration), so `extract-romsets.ts` now falls back to one `-listxml` per machine. Vector titles verified to draw through the bridge's software renderer.
- 2026-10-21 — Release-owner spot check found titles on Sega, Midway, Konami, Atari, Data East, Seibu and Taito F3 boards outside every build. Decision: seven more family packages (W19a–g, milestone M21) land before the 1.0.0 commit; §4.6 rows added. 3D (namcos21/22), Naomi and pinball drivers stay out of scope.
- 2026-10-21 — Hand test found a CPS-2 title aborting with `OOM` at 256 MiB and the largest Neo Geo sets rejected by the memory pre-check. Measured by relinking at 384/512/1024 MiB: all boot at 384. `memoryPages` raised to 8,192 for `cps2` and `neogeo`; adapter maps an `OOM` abort to `MEMORY_EXCEEDED`. F3 records updated.
- 2026-10-21 — Release-owner hand test: audio dropouts on a Neo Geo and a Namco classic title traced to the browser gate running concurrently on the same machine; audio clean once idle (probe: 0 gaps idle, 35 gaps fully loaded, 1 gap half loaded). M20 opened. Cabinet menu now lists the keyboard bindings.
- 2026-10-21 — Hand test: three CPS-1, CPS-2 and Neo Geo titles garbled for the whole session on their first start in a tab, clean after reload. Headless library-flow probe reproduced it: every scheduled buffer on the first run was 120 ms (the cap), 20 ms after reload. Cause: `ArcadeAudio` trimmed an overflow only to the cap and restarted the rebuilt audio with the 20 ms lead; with the lead equal to the frame period nothing played before the next chunk overflowed again, so one stall (a freshly created context whose clock had not started, or a catch-up burst) pinned the queue for the rest of the session. Fix: an overflow trims to `TRIM_QUEUE_MS` 60 and restarts at the clock with no lead; spec §8 and tests 18 updated (new "cap recovery" case). Probe after the fix: a CPS-2 title, a Neo Geo title and `galaga.c` first runs schedule 20 ms buffers with one trim near start. This was also the persistence mechanism behind the earlier "awful" audio under load.
- 2026-10-21 — W18 merged: harness is a drop-first library (zip basename → family and title from served metadata, per-card audit verdict and Start, folded settings, `?family=` limit). Integrator follow-up folded selectors and fixed companion wording. §11 and §11.1 amended.
- 2026-10-21 — **Final verification run** on `d09f540`: fresh nine-family rebuild; check and spec green; browser gate green with the Neo Geo preload and five family configs (F4 344–1173 ms, F5 worst 0.56 %, F6 0.9999–1.0002, audio peak 57–77 ms) and with the Namco classic DIP preload. Harness gained `--page` so a device-capability page is served at `/device-test` for other LAN devices. Six-button CPS-2 acceptance deferred to M18. Desktop walkthrough handed to the release owner.
Newest first. One line per merge, milestone close, or contract amendment.

- 2026-10-20 — **M3, M4, M5 closed** by `36-input-audio-acceptance.test.ts` on the Neo Geo and Namco sets (audio peak 68–71 ms under the 120 ms cap over 60 s; keyboard and two-pad flows verified; unplug release verified).
- 2026-10-21 — cps1 and cps2 F4–F6, M3–M5 and the CPS-2 EEPROM flush recorded from lawful sets (7z sets converted to zips under the ignored res/ tree). **M2 and M6 closed for v1.0.0.**
- 2026-10-21 — Decision: namco-s1, namco-s2 and taito-classic drop from the v1.0.0 required matrix (no lawful local sets); README lists supported families. Patch 0004 makes the 0.161 QSound placeholder ROM optional: the pinned DSP16 core is a stub, and current QSound device dumps carry a different file, so every CPS-2 and CPS-1.5 title refused to start.
- 2026-10-21 — Full fresh rebuild of all nine families with the SDL2 notice; build-output gate exposed four taito-classic metadata files with a defaultless DIP field (generator now omits such fields). taito-16 F4–F6 and M3–M5 recorded from a lawful set. Licence review decision recorded in docs/release.md.
- 2026-10-21 — W17 merged: isolated `npm pack` test with the packed bin run against a synthetic set, build-output gate over every built family, `docs/release.md`, SDL2 notice added to the P1 copy. Integrator applied the `package.json` `files` list and moved `tsx` to dependencies (the bin stays TypeScript); `version` stays 0.0.0 and `private` stays until the release itself.
- 2026-10-21 — W13c merged: harness BIOS and DIP selectors from the served machine metadata, restart-with-switches; §16.3/§16.4 updated for the W13c split. M8 fully closed.
- 2026-10-21 — W16 merged: generated per-machine DIP cfg, BIOS selection, `ArcadeStartConfig` DIP/BIOS fields. Integrator fix: the visual DIP check compared frames inside the Namco classic title's 13-second self test, which is DIP-independent; checkpoints moved to 15–20 emulated seconds. **M8 closed** for the library; W13c (harness selectors §11) and W17 started.
- 2026-10-20 — W13b merged: cabinet harness page (picker, ROM store, saves, corner menu). **M7 closed.** W16 started.
- 2026-10-20 — W15 merged: memory-card mount and flush, F8 recorded (0.161 screen bitmaps are not state, so next-frame identity after a restore is a core limitation). W16 brief written.
- 2026-10-20 — F4–F6 measured on desktop for neogeo, namco-classic (vertical and heaviest titles) and irem-m72: pacing within 0.35 % at 60–144 Hz cadences, 60 s ratios 0.9999–1.0003, startup 0.3–1.1 s. W13b started.
- 2026-10-20 — Device ROM sets modelled (`device` role); the user's lawful sets audit ok for neogeo, namco-classic and irem-m72. `33-family-measurements.test.ts` added for F4–F6. W15 started; W13b brief written.
- 2026-10-20 — W12 merged: `ArcadeCabinet`. Audit gained a CRC-and-size fallback (older naming generations load as MAME does); `build-mame` records applied patch sets per tree.
- 2026-10-20 — W14f merged: `taito-16` family (189 machines, 6.9 MB wasm). All eight required families now build; M2 awaits F4–F6 with lawful sets. W15 brief written.
- 2026-10-20 — W14e merged: `taito-classic` family (151 machines, 6.0 MB wasm); §4.6 row extended with the M6809/MCS51 and sound cores the link needs.
- 2026-10-20 — **M1 closed.** `30-m1-acceptance.test.ts` against the pipeline-built Neo Geo artifact: 59.34 fps on a 60 Hz cadence and 59.13 fps on 120 Hz against 59.186 Hz native, upright at native size (evidence in docs/probes/families/neogeo.md).
- 2026-10-20 — W13a merged: `serve-harness --preload` and the preload harness page; the gated real-build case starts a machine and renders its first frame.
- 2026-10-20 — W14c merged: `namco-s1` family (47 machines, 5.0 MB wasm, no target corrections). W14e started.
- 2026-10-20 — W11 merged: `ArcadePlayer`; its production case exposed and fixed BIOS-option audit handling and the 1.38 thenable-Module hang. W13a, W14c, W14d started.
- 2026-10-20 — W14b merged: `namco-classic` family (378 machines, 7.4 MB wasm); galaxian.c adds 85 KiB Brotli so `galaxian-misc` stays folded in.
- 2026-10-20 — W14a merged: `cps2` family (293 machines, 6.1 MB wasm, 137 s clean build); §4.6 row corrected for the CPS-1 unit coupling.
- 2026-10-20 — M2 started: shared W14 brief written; cps2 and namco-classic agents launched (F3–F6 pending private sets).
- 2026-10-20 — W4 merged: `MameEmulatorAdapter`, `MameSession`, overlay codec; real-build browser case passes. Decisions: default loader is classic-script injection (artifact is not ESM); snapshot taken at first frame after a flush; byte-identical video after state restore moved to F8/M6. W11 started.
- 2026-10-20 — Integration: `build-mame neogeo` from a clean unpack with the production patches (2m10s, 256 machines, 256 romsets); the W3 browser cases pass against that artifact.
- 2026-10-20 — W3 merged: production web bridge (patches 0001–0003, `mame/bridge/`), link contract recorded in `mame/bridge/README.md`; `build-mame` link flags reconciled. Observed: Neo Geo memory card writes nothing through the narrow NVRAM flush (F8 item for W15). W4 started.
- 2026-10-20 — W2 merged (integrator): `build-mame.ts`, `extract-romsets.ts`, `scripts/mame-build/`, family build files; neogeo built end to end with 256 romsets. §4.1 amended for the two toolchain patches.
- 2026-10-20 — W8 merged: `GamepadSource`; §10.4 clarified that pause release is the player's job.
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
