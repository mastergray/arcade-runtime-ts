# W10 merge note

## `src/index.ts`

Add the class export in the existing class section and the metadata/report
exports in the class-owned types and predicates section:

```ts
export { default as RomSetAudit } from "./RomSetAudit/RomSetAudit.js";
export { isRomSetMetadata, isRomSetReport, type RomSetMetadata, type RomSetReport } from "./RomSetAudit/types.js";
```

No `tests/run.ts` entry is needed because the runner discovers `*.test.ts`
files.

## `package.json`

Add the command's TypeScript entry point to the top-level package fields:

```json
"bin": {
  "arcade-audit-roms": "./scripts/audit-roms.ts"
}
```

The script has the same `node --import tsx` shebang as the repository's other
direct TypeScript command and is exercised by invoking that entry point in a
child process.

## Spec notes

Two details in §10.5 should be brought in line with the W10 brief:

- The declared `RomSetReport` omits the brief-required `problems` array. W10
  adds `problems: ReadonlyArray<{ archive: RomName; reason: NonEmptyString }>`
  so malformed, corrupt and over-limit archives remain report data rather
  than exceptions.
- The final paragraph describes the command as taking `<family-build-dir>`,
  while the W10 brief requires `<romsets-dir>` and explicitly reads
  `<romsets-dir>/<machine>.json`. The implementation follows the brief.

The W10 brief's suggested `unzipSync` metadata filter exposes entry names and
compressed/uncompressed sizes, but fflate 0.8.2's public `UnzipFileInfo` does
not expose CRC32. The implementation therefore uses `unzipSync` with an
always-false filter to validate and enumerate the central directory without
inflating, then reads only each central-directory header's CRC32 field. No
entry data is sliced or decompressed.

The spec shows `bios: []` without declaring its element shape. W10 treats it
as a case-insensitively unique array of non-empty BIOS names; `cloneof`,
`romof` and `sampleof` are non-empty names or `null`.

## Hand-run bin output

This was produced with the brief's command over a temporary synthetic
`fakegame` metadata file and exactly two zips generated from random bytes:

```text
Machine: fakegame
Status: ok

ARCHIVES
NAME            ROLE    PRESENT  REQUIRED
--------------  ------  -------  --------
fakegame.zip    game    yes      yes
fakeparent.zip  parent  yes      yes

FILES
ARCHIVE         NAME        STATUS
--------------  ----------  ------
fakegame.zip    game.bin    ok
fakeparent.zip  parent.bin  ok

UNEXPECTED
(none)

PROBLEMS
(none)
```

## Verification

- `npm run check`: pass.
- `npm test`: pass, 298/298 spec cases.
- `npm run test:browser`: W10 adds no browser cases. The 22 native MAME probe
  cases skipped for their documented unset local variables. The seven
  pre-existing `ArcadeDisplay` cases could not start their ephemeral server
  in this managed environment because binding `127.0.0.1` returned `EPERM`;
  they failed before launching Chromium.
- `git diff --check main...HEAD`: pass before this note.
- The branch changes only the W10 write set, its two named spec tests, the
  synthetic fixture directory and this merge note.
