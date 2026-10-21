# W17 merge note

## Summary

W17 adds the isolated npm-package and real build-output release gates, copies
the SDL2 notice missing from the P1 build inventory, and documents the v1.0.0
release, licence and hosted-harness policies.

The package decision is to retain the TypeScript `arcade-audit-roms` entry
point and declare `tsx` as a runtime dependency. The isolated tarball test
builds outside the worktree, adds forbidden sentinel content before packing,
checks the resulting file list, unpacks the tarball and runs that bin against
a generated synthetic ROM-set directory.

`LICENSE` did not need a change: its existing scope paragraph already limits
the MIT grant to the original runtime and npm code and expressly excludes
third-party emulator source, generated artifacts, ROM data and MAME-derived
patch portions.

## Integrator-owned changes

Apply these changes to `package.json`:

```json
{
  "version": "1.0.0",
  "files": [
    "dist",
    "!dist/mame",
    "src",
    "scripts/audit-roms.ts",
    "LICENSE",
    "README.md"
  ],
  "bin": {
    "arcade-audit-roms": "./scripts/audit-roms.ts"
  },
  "dependencies": {
    "fflate": "^0.8.2",
    "tsx": "^4.23.11"
  }
}
```

- Remove `"private": true`.
- Remove `"manifests/shell"` from `files`.
- Move `tsx` from `devDependencies` to `dependencies`; the bin's shebang is
  `node --import tsx`.
- Keep the existing `build:package` script. It exists and needs no change.
- Keep the existing root and `./package.json` exports. They already match
  §1.4.
- Refresh `package-lock.json` after making the version and dependency-scope
  changes.

No `src/index.ts` line is needed. No spec edit is needed.

## Verification

```text
npm run check
PASS

npm test
TALLY files=30 cases=503 passed=501 failed=0 skipped=2
```

The package-content cases both ran and passed. The build-output gate
discovered four available production family directories and validated each
one's `build.json`, artifacts, listed notices, complete ROM-set metadata and
fixed non-threaded WebAssembly memory. Configured families without local
output skipped their inspection stages and did not fail the suite.

The final merge-note commit was attempted after verification, but the sandbox
refused creation of the worktree's Git index lock. Per the package instruction,
this merge-note file is left uncommitted; the three implementation and
documentation commits made before that refusal remain on the branch.

The existing shared build outputs predate the SDL2 notice fix. The release
procedure's required fresh rebuild will regenerate their `build.json` files
and notice bundles with the added SDL2 entry.

## Tarball file listing

This is the complete listing from the isolated proposed `1.0.0` tarball:

```text
package/LICENSE
package/dist/ArcadeAudio/ArcadeAudio.js
package/dist/ArcadeCabinet/ArcadeCabinet.js
package/dist/ArcadeDisplay/ArcadeDisplay.js
package/dist/ArcadeInput/ArcadeInput.js
package/dist/ArcadePlayer/ArcadePlayer.js
package/dist/ArcadeRomStore/ArcadeRomStore.js
package/dist/ArcadeRuntimeError/ArcadeRuntimeError.js
package/dist/ArcadeStorage/ArcadeStorage.js
package/dist/ControllerConfig/controllerConfigFor.js
package/dist/DipConfig/dipConfigFor.js
package/dist/GamepadSource/GamepadSource.js
package/dist/index.js
package/dist/ArcadeStorage/indexedDB.js
package/dist/KeyboardSource/KeyboardSource.js
package/dist/MameEmulatorAdapter/MameEmulatorAdapter.js
package/dist/MameEmulatorAdapter/MameSession.js
package/dist/MameEmulatorAdapter/OverlayCodec.js
package/dist/RomSetAudit/RomSetAudit.js
package/dist/ArcadePlayer/RomSourceResolver.js
package/dist/shared.types.js
package/dist/ArcadeAudio/types.js
package/dist/ArcadeCabinet/types.js
package/dist/ArcadeDisplay/types.js
package/dist/ArcadeInput/types.js
package/dist/ArcadePlayer/types.js
package/dist/ArcadeRomStore/types.js
package/dist/ArcadeRuntimeError/types.js
package/dist/ArcadeStorage/types.js
package/dist/ControllerConfig/types.js
package/dist/GamepadSource/types.js
package/dist/KeyboardSource/types.js
package/dist/MameEmulatorAdapter/types.js
package/dist/RomSetAudit/types.js
package/package.json
package/README.md
package/dist/ArcadeAudio/ArcadeAudio.d.ts
package/src/ArcadeAudio/ArcadeAudio.ts
package/dist/ArcadeCabinet/ArcadeCabinet.d.ts
package/src/ArcadeCabinet/ArcadeCabinet.ts
package/dist/ArcadeDisplay/ArcadeDisplay.d.ts
package/src/ArcadeDisplay/ArcadeDisplay.ts
package/dist/ArcadeInput/ArcadeInput.d.ts
package/src/ArcadeInput/ArcadeInput.ts
package/dist/ArcadePlayer/ArcadePlayer.d.ts
package/src/ArcadePlayer/ArcadePlayer.ts
package/dist/ArcadeRomStore/ArcadeRomStore.d.ts
package/src/ArcadeRomStore/ArcadeRomStore.ts
package/dist/ArcadeRuntimeError/ArcadeRuntimeError.d.ts
package/src/ArcadeRuntimeError/ArcadeRuntimeError.ts
package/dist/ArcadeStorage/ArcadeStorage.d.ts
package/src/ArcadeStorage/ArcadeStorage.ts
package/scripts/audit-roms.ts
package/dist/ControllerConfig/controllerConfigFor.d.ts
package/src/ControllerConfig/controllerConfigFor.ts
package/dist/DipConfig/dipConfigFor.d.ts
package/src/DipConfig/dipConfigFor.ts
package/dist/GamepadSource/GamepadSource.d.ts
package/src/GamepadSource/GamepadSource.ts
package/dist/index.d.ts
package/src/index.ts
package/dist/ArcadeStorage/indexedDB.d.ts
package/src/ArcadeStorage/indexedDB.ts
package/dist/KeyboardSource/KeyboardSource.d.ts
package/src/KeyboardSource/KeyboardSource.ts
package/dist/MameEmulatorAdapter/MameEmulatorAdapter.d.ts
package/src/MameEmulatorAdapter/MameEmulatorAdapter.ts
package/dist/MameEmulatorAdapter/MameSession.d.ts
package/src/MameEmulatorAdapter/MameSession.ts
package/dist/MameEmulatorAdapter/OverlayCodec.d.ts
package/src/MameEmulatorAdapter/OverlayCodec.ts
package/dist/RomSetAudit/RomSetAudit.d.ts
package/src/RomSetAudit/RomSetAudit.ts
package/dist/ArcadePlayer/RomSourceResolver.d.ts
package/src/ArcadePlayer/RomSourceResolver.ts
package/dist/shared.types.d.ts
package/src/shared.types.ts
package/dist/ArcadeAudio/types.d.ts
package/dist/ArcadeCabinet/types.d.ts
package/dist/ArcadeDisplay/types.d.ts
package/dist/ArcadeInput/types.d.ts
package/dist/ArcadePlayer/types.d.ts
package/dist/ArcadeRomStore/types.d.ts
package/dist/ArcadeRuntimeError/types.d.ts
package/dist/ArcadeStorage/types.d.ts
package/dist/ControllerConfig/types.d.ts
package/dist/GamepadSource/types.d.ts
package/dist/KeyboardSource/types.d.ts
package/dist/MameEmulatorAdapter/types.d.ts
package/dist/RomSetAudit/types.d.ts
package/src/ArcadeAudio/types.ts
package/src/ArcadeCabinet/types.ts
package/src/ArcadeDisplay/types.ts
package/src/ArcadeInput/types.ts
package/src/ArcadePlayer/types.ts
package/src/ArcadeRomStore/types.ts
package/src/ArcadeRuntimeError/types.ts
package/src/ArcadeStorage/types.ts
package/src/ControllerConfig/types.ts
package/src/GamepadSource/types.ts
package/src/KeyboardSource/types.ts
package/src/MameEmulatorAdapter/types.ts
package/src/RomSetAudit/types.ts
```

There were 103 entries and no match for a forbidden path or `.wasm`, `.zip`,
`.bc` or `.sta` extension.

## Packed bin output

The tarball was unpacked, its declared bin target was run with the declared
`tsx` loader, and all audit inputs were generated in the temporary directory:

```json
{
  "machine": "synthetic-machine",
  "status": "ok",
  "archives": [
    {
      "name": "synthetic-set.zip",
      "role": "game",
      "present": true,
      "required": true
    }
  ],
  "files": [
    {
      "name": "payload.bin",
      "archive": "synthetic-set.zip",
      "status": "ok"
    }
  ],
  "unexpected": [],
  "problems": []
}
```

## Proposed v1.0.0 changelog

### Added

- A pinned direct-MAME 0.161 WebAssembly bridge, adapter, display and preload
  harness with fresh-module lifecycle and native-refresh pacing.
- Separate builds for all eight required hardware families, with generated
  ROM-set metadata, deterministic build identities, fixed-memory threading
  inspection and recorded family measurements.
- Synchronized browser audio, generated keyboard controls and independent
  standard-gamepad input with disconnect release.
- Save overlays, browser storage, memory-card and EEPROM persistence, and named
  save states.
- ROM-set auditing for parent, BIOS, device and optional-sample relationships;
  a local `arcade-audit-roms` command; a browser-local ROM store; and the
  `ArcadeCabinet` composition root.
- A local cabinet harness with private preload and file-picker paths, BIOS
  selection and generated DIP-switch configuration.
- Release gates for npm contents, the packed audit bin, family artifacts,
  licence notices, ROM-set metadata and non-threaded WebAssembly output.

### Distribution

- Published npm contents are limited to the MIT-licensed TypeScript runtime,
  compiled library, declarations and local audit bin. ROMs, the harness,
  source caches, MAME builds and emulator notice bundles are excluded.
- Family builds remain consumer-built and consumer-hosted under the historical
  MAME 0.161 terms with the complete P1 notice set beside them. They are not
  separate v1.0.0 release assets.
- Publicly hosting the developer harness with ROM, BIOS, sample or private
  preload content is prohibited by repository policy.

## Spec review

No named W17 spec section appears wrong. P1 correctly requires both the
Emscripten and SDL2 notices; the implementation's notice copy omitted SDL2,
which W17 fixes for fresh builds.
