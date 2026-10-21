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
input, saves and lifecycle. Target hardware is SNK Neo Geo, Capcom CPS-1 and
CPS-2, and the classic Namco and Taito architectures from `pacman.c` and `galaga.c`
hardware through Namco System 2 and Taito F2.

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
