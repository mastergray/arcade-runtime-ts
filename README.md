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

Implementation stage, beginning at M1. The M0 feasibility probe is inherited
complete from the parent project: direct MAME 0.161 source, built with a
pinned Emscripten 1.38.31 toolchain, is the implementation path, and the
probe evidence lives under `docs/probes/mame0161/`.

See the [implementation spec](docs/arcade-runtime-spec.md) for the
architecture, family build matrix, milestones, probe plan and acceptance
criteria. The parent project's spec is kept for reference at
`docs/parent/mame-game-runtime-spec.md`.

## Licensing

The original TypeScript runtime and npm package use the
[MIT licence](LICENSE). MAME is a separately built input: source patches and
generated MAME 0.161 artifacts retain MAME's historical licence and all
applicable third-party notices rather than being relicensed as MIT.

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
ROM licensing are separate release gates; no prebuilt MAME artifact or game
content is distributed by default.
