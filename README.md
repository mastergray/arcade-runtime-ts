# arcade-runtime-ts

A headless TypeScript runtime for playing arcade games in the browser from
ROM files the user supplies at run time. It is a fork of
[`mame-game-runtime-ts`](https://github.com/mastergray/mame-game-runtime-ts)
that picks up at milestone M1, and it follows the runtime model of
[`dos-game-runtime-ts`](https://github.com/mastergray/dos-game-runtime-ts)
with one deliberate difference: there are no deployments. The library never
packages, copies, hosts or links to ROMs. A page composes the runtime, obtains
ROM zips from its own user, and is responsible for what it loads.

The runtime owns the pinned MAME-to-WebAssembly family builds, video, audio,
input, saves and lifecycle.

## Supported families

Each family is a separate MAME 0.161 build selected by `mame/targets/`. The
emulator core is pinned at 0.161, so ROM sets must be the 0.161 generation of
each set; the `arcade-audit-roms` command and the runtime's audit report say
exactly which archive and file a set is missing.

| Family | Hardware | v1.0.0 |
| ------ | -------- | :----: |
| `neogeo` | SNK Neo Geo MVS/AES (needs the user's `neogeo.zip` BIOS) | measured |
| `cps1` | Capcom CPS-1 and CPS-1.5 (QSound titles) | measured |
| `cps2` | Capcom CPS-2 | measured |
| `namco-classic` | Namco `pacman.c`, `galaga.c`, `polepos.c` and related boards (need the user's Namco custom I/O device ROMs) | measured |
| `taito-16` | Taito 16-bit boards (B, F2, X, Z System, H and related) | measured |
| `taito-f3` | Taito F3 (68EC020 with the Ensoniq sound board) | measured |
| `irem-m72` | Irem M72 and M92 | measured |
| `sega-16` | Sega `segahang.c`, `segaorun.c`, `segaxbd.c` and `segaybd.c` boards | measured |
| `sega-s16` | Sega System 16A, 16B and 18 (`segas16a.c`, `segas16b.c`, `segas18.c`) | measured |
| `midway-tunit` | Midway T-Unit, Y-Unit and Wolf Unit (`midtunit.c`, `midyunit.c`, `midwunit.c`; Williams ADPCM and DCS sound boards) | measured |
| `atari-gauntlet` | Atari 68010 boards (`gauntlet.c` with slapstic, `toobin.c` with the JSA sound board) | measured |
| `sega-s32` | Sega System 32 (`segas32.c`; V60 with the V25 protection MCU, MultiPCM) | measured |
| `seta-2` | Seta 2 board (`seta2.c`; TMP68301 with X1-010 sound) | measured |
| `namco-nb` | Namco NB-1 and NB-2 (`namconb1.c`; 68EC020 with the C75 sound MCU and C352) | builds; below the F6 gate on desktop (0.82–0.92) |
| `midway-mcr` | Bally/Midway MCR-1/2/3, MCR-68k and the Williams 6809 board (`williams.c`) | measured |
| `konami-16` | Konami 68000 boards (`tmnt.c`, `simpsons.c`, `xmen.c`, `gijoe.c`, `mystwarr.c`, `spy.c` hardware) | measured |
| `atari-classic` | Atari vector boards (`bzone.c`, `tempest.c`), `rampart.c` and the 6502 `centiped.c` board | measured |
| `misc-16` | Data East (`dec0.c`, `karnov.c`), Seibu (`raiden.c`, `raiden2.c`, `r2dx_v33.c`), Toaplan `snowbros.c`, Technos `shadfrce.c`, Rare `btoads.c` and Data East `cninja.c` boards (`btoads.c` needs the user's `bsmt2000.zip` device ROM) | measured |
| `namco-s1` | Namco System 1 and System 86 | builds; evidence deferred |
| `namco-s2` | Namco System 2 | builds; evidence deferred |
| `taito-classic` | Taito 8-bit boards (`bublbobl.c`, `arkanoid.c`, `tnzs.c` and related) and the Taito America `qix.c` board | measured |
| `nintendo-classic` | Nintendo Z80 board (`dkong.c`; 8035 sound, NES APU, discrete) | measured |
| `leland` | Leland twin-Z80 board with the 80186 sound CPU (`leland.c`) | measured |
| `gottlieb` | Gottlieb 8088 board with the rev 1 sound board (`gottlieb.c`) | measured |

The `neogeo` and `cps2` builds link a 512 MiB fixed heap because their largest sets need more than 256 MiB once loaded and decoded; the other families link 256 MiB. A browser must be able to reserve that much for the tab.

"Measured" means the family's startup, pacing, sustained-speed and
input/audio acceptance evidence was recorded from a lawful local set
(`docs/probes/families/`). "Evidence deferred" families compile, pass the
threading and release gates and ship metadata, but no title was run on them
for v1.0.0 because no lawful set was available locally.

## Status

Implementation stage. M1 (bridge, adapter, display, preload harness) closed
on 2026-10-20 with a Neo Geo title running at its native refresh on 60 and
120 Hz cadences from a clean-checkout build; the family build matrix (M2) is
in progress. The M0 feasibility probe is inherited complete from the parent
project: direct MAME 0.161 source, built with a
pinned Emscripten 1.38.31 toolchain, is the implementation path, and the
probe evidence lives under `docs/probes/mame0161/`.

See the [roadmap](docs/ROADMAP.md) for current status and the
[implementation spec](docs/arcade-runtime-spec.md) for the
architecture, family build matrix, milestones, probe plan and acceptance
criteria. The parent project's spec is kept for reference at
`docs/parent/mame-game-runtime-spec.md`.

## Licensing

The original TypeScript runtime and npm package use the
[MIT licence](LICENSE). MAME is a separately built input: source patches and
generated MAME 0.161 artifacts retain MAME's historical licence and all
applicable third-party notices rather than being relicensed as MIT. The
historical MAME terms prohibit commercial distribution and require the
copyright notice, conditions, disclaimer and complete corresponding source
for a modified redistribution, subject to the licence's stated exception.

The npm package contains no MAME build or emulator notice bundle. A consumer
that builds and hosts a family artifact must keep its generated `notices/`
directory beside the JavaScript and WebAssembly files and independently meet
the historical MAME and third-party terms. The v1.0.0 review and distribution
decision are recorded in the [release procedure](docs/release.md).

## Development

The scaffold requires Node.js 22.13 or newer and npm:

```sh
npm install
npm run check
npm test
npm run build
```

The package currently exposes an intentionally empty public module. Runtime
exports begin with M1.

## Repository policy

ROMs, BIOS sets, sample sets, native emulator binaries, locally compiled
emulator artifacts and source caches are excluded from version control.
Private probe and preload configs that name local ROM files live under the
ignored `res/` directory and never enter source, packages or CI. Emulator and
ROM licensing are separate release gates. The npm package excludes `res/`,
the developer harness, tests, caches and every locally built family artifact;
no prebuilt MAME artifact, emulator notice bundle or game content is
distributed through npm.

The harness is a local development tool, not a deployment. It is never hosted
publicly with ROMs, BIOS or sample content, and private preload configuration
is never committed or attached to a release. A consumer-hosted page obtains
lawful ROM files from its own user at run time and is responsible for what it
loads.
