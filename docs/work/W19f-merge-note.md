# W19f merge note — Irem M72/M92 and Taito Z

Status: ready for review. Both extended production family builds, metadata
extraction, explicit threading inspections, static checks and the full spec
suite pass. Browser measurements for the new M92 and Taito Z drivers remain a
documented integrator follow-up because this sandbox cannot bind loopback or
start Chromium.

## Deliverables

- `irem-m72` now compiles `drivers/m92.c` and `video/m92.c` alongside M72,
  with the Irem GA20 and OKIM6295 sound cores and the buffered-sprite video
  core required by the complete M92 list.
- `irem-m72.lst` now derives from both driver sources and contains 71 public
  machines; its build manifest and `FAMILY_TARGETS` row match that scope.
- `taito-16` now compiles `drivers/taito_z.c` and `video/taito_z.c` alongside
  the existing ten Taito driver groups.
- `taito-16.lst` now derives from all eleven driver sources and contains 223
  public machines; its build manifest and `FAMILY_TARGETS` row match that
  scope.
- Both family records have a dated “extended by W19f” section with fresh
  F1–F3 evidence and explicit pending-integrator F4–F6 rows for the new
  drivers. Existing F4–F6 sections were retained unchanged.

No runtime source, build script, production patch, bridge file, package file,
spec section or other family's file changed. No integrator-owned line is
needed. No ROM content, private machine identity, ROM filename, ROM hash or
absolute local path was added to tracked files.

## Production artifacts

The final timed cached-source Irem pipeline completed in 33.55 seconds:

```text
dist/mame/irem-m72/
├── build.json                       2,612 bytes
├── mameirem-m72.js                302,519 bytes
├── mameirem-m72.wasm            5,574,888 bytes
├── notices/                           14 files, 562,168 aggregate bytes
└── romsets/                           71 files, 862,427 aggregate bytes
```

- Machine count: 71
- buildId: `60258693a34ad579c0e95f6385aa0dc533b1bdfdcbefd41797c9da8508a589c9`
- Wasm compression: 1,518,686 gzip-9 bytes; 1,142,314 Brotli-11 bytes
- JavaScript compression: 65,606 gzip-9 bytes; 55,379 Brotli-11 bytes
- F3 largest public metadata ROM sum: 11,141,120 bytes
- Conservative two-copy peak: 22,282,240 bytes, 11.07% of the
  201,326,592-byte safe budget
- Memory: fixed 4,096 pages, non-shared; threading gate passed

The final timed cached-source Taito pipeline completed in 47.16 seconds:

```text
dist/mame/taito-16/
├── build.json                       4,981 bytes
├── mametaito-16.js                302,504 bytes
├── mametaito-16.wasm            7,074,473 bytes
├── notices/                           14 files, 562,168 aggregate bytes
└── romsets/                          223 files, 2,032,446 aggregate bytes
```

- Machine count: 223
- buildId: `ab64a8cf8311ab1ca1211b5415e6ca8e27073855ce381b2b9d517507b3fe6c1f`
- Wasm compression: 1,772,767 gzip-9 bytes; 1,313,884 Brotli-11 bytes
- JavaScript compression: 65,607 gzip-9 bytes; 55,309 Brotli-11 bytes
- F3 largest public metadata ROM sum: 12,124,160 bytes
- Conservative two-copy peak: 24,248,320 bytes, 12.04% of the
  201,326,592-byte safe budget
- Memory: fixed 4,096 pages, non-shared; threading gate passed

Both families remain at 4,096 pages because every metadata estimate fits the
safe adapter budget.

## Target findings and corrections

The independently derived Irem list added 36 M92 machines to the existing 35.
Source inspection selected `IREMGA20` and `OKIM6295`; the first diagnostic link
then reported `BUFFERED_SPRITERAM16` undefined, and selecting the pinned
`BUFSPRITE` video core resolved it. The complete link reported no further
missing symbol.

The independently derived Taito list added 34 Z System machines to the existing
189. The existing target already supplied every CPU, sound, EEPROM, I/O, road,
palette and tilemap dependency used by `taito_z.c`; its first complete link
passed without another unit or core.

The prescribed Irem build initially encountered the known bundled Node.js 8
`ERR_UNKNOWN_STREAM_TYPE` failure under captured stdio. Following the W19a
precedent, an ignored `BASH_ENV` file selected host Node.js 22 only for the old
Emscripten compiler subprocess. The same untracked compatibility environment
was used for both final builds. Nothing from it is committed.

## Browser evidence follow-up

One ignored lawful preload config was present for a title from each new driver.
Per the work-package instruction, the browser suite was not attempted in this
sandbox. Consequently, no first frame arrived here, non-blank output for the
new drivers is not yet confirmed, and their F4 startup, F5 geometry/cadence and
F6 sustained-ratio measurements are marked “pending integrator browser run.”
The older family F4–F6 evidence remains in place.

On a host that permits Chromium and loopback, the integrator should supply each
ignored config to the family-measurement browser mechanics and copy only the
privacy-safe measurements into the records. Do not record the configured
machine, ROM filenames, hashes or resolved paths.

## Verification

The prescribed build command was run first for Irem and stopped at the known
bundled-Node stream incompatibility:

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts irem-m72 --jobs 4
```

The successful production commands used the ignored compatibility environment:

```sh
BASH_ENV="$PWD/.cache/w19f-bash-env.sh" EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts irem-m72 --jobs 4
BASH_ENV="$PWD/.cache/w19f-bash-env.sh" EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts taito-16 --jobs 4

/usr/bin/time -f 'WALL_SECONDS=%e' env \
  BASH_ENV="$PWD/.cache/w19f-bash-env.sh" EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts irem-m72 --jobs 4
/usr/bin/time -f 'WALL_SECONDS=%e' env \
  BASH_ENV="$PWD/.cache/w19f-bash-env.sh" EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts taito-16 --jobs 4

npm run probe:mame:threading -- "$PWD/dist/mame/irem-m72/mameirem-m72"
npm run probe:mame:threading -- "$PWD/dist/mame/taito-16/mametaito-16"
npm run check
npm test
```

- Irem production build: passed; 71 machines and 71 ROM-set metadata files
- Taito production build: passed; 223 machines and 223 ROM-set metadata files
- Explicit threading inspections: 2 passed; both fixed at 4,096 non-shared
  pages with 0 worker markers and no pthread requirement
- `npm run check`: passed (`check:src` and `check:tests`)
- `npm test`: 30 files, 509 cases; 509 passed, 0 failed, 0 skipped
- Browser suite: not run, as required for this sandbox; 2 new-driver F4–F6
  measurement sets remain pending the integrator run
