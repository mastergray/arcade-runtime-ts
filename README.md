# mame-game-runtime-ts

Run MAME arcade games in the browser through a headless TypeScript
runtime, following the deployment model established by
[`dos-game-runtime-ts`](https://github.com/mastergray/dos-game-runtime-ts).

The runtime will own the pinned MAME-to-WebAssembly build, video, audio,
input, saves and lifecycle. A game's page will own its layout, controls
and ROM inputs. A manifest and shared shell will turn those inputs into
a standalone static deployment for desktop and mobile browsers.

## Status

Specification and feasibility-probe stage. Direct MAME source is the
primary implementation path, initially targeting the authenticated official
MAME 0.161 tag. Native and WebAssembly comparison builds come from that same
source tree.

See the [implementation spec](docs/mame-game-runtime-spec.md) for the
architecture, milestones, probe plan and acceptance criteria.

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
exports begin after M0 establishes a viable direct-MAME toolchain and bridge.

## Repository policy

ROMs, native emulator binaries, locally compiled emulator artifacts and
source caches are excluded from version control. Emulator and ROM
licensing are separate release gates; no prebuilt MAME artifact or game
content is distributed by default.
