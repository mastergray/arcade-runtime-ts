# W10 — `RomSetAudit` and the `arcade-audit-roms` bin

Lane: **TypeScript**. Branch: `wp/w10-romset-audit`. Milestone: M7.

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W10 | `RomSetAudit` and the `arcade-audit-roms` bin | `src/RomSetAudit/`, `scripts/audit-roms.ts` | W0 | §10.5 | T | M7 |

## 2. Spec sections to read first

`docs/arcade-runtime-spec.md` §0–§3, §16, then §10.5 in full, §0.3
(what the repository may and may not hold about ROMs), §2.3 (`RomFile`,
`RomRole`, `romNameKey`), §3 (`ROM_SET_INVALID` carries your report as
`data`), §4.6 ("Sample sets" and "BIOS selection" bullets), and §9's
`audit()` which consumes your class.

Background on how MAME resolves merged sets: in a `-listxml` machine
element, each `<rom>` has `name`, `size`, `crc`, `sha1`, optional
`merge` (the name it has in the parent set), optional `bios` (the BIOS
option it belongs to), and `status="nodump"` / `optional="yes"`
attributes; the machine has `cloneof`, `romof` and `sampleof`. A ROM with
`merge` lives in the parent's zip when the user has a split set; a BIOS
ROM lives in the `romof` BIOS zip. §10.5's metadata extractor (W2) will
flatten that into the per-machine JSON shown there with an explicit
`archive` per ROM; **you consume that JSON and never parse XML**.

## 3. Write set

Exclusive: `src/RomSetAudit/` (`RomSetAudit.ts`, `types.ts`),
`scripts/audit-roms.ts`, plus your tests:
`tests/spec/19-romset-audit.test.ts` and
`tests/spec/19-romset-metadata.test.ts`, and a fixture directory
`tests/support/fixtures/romsets/` holding **synthetic** metadata JSON and
synthetic zips you generate in the test (never real ROM data; invent
machine names like `fakegame`, `fakeclone`, `fakebios`).

You will need export lines in `src/index.ts` for `RomSetAudit` and your
`types.ts` re-exports, and a `bin` entry in `package.json` for
`arcade-audit-roms`. Do not add them; list them in your merge note.

## 4. Deliverables

1. **Metadata types** in `types.ts`: `RomSetMetadata` exactly as §10.5
   shows (`machine`, `family`, `description`, `cloneof`, `romof`, `bios`,
   `sampleof`, `archives[]` with `name` and `role`, `roms[]` with `name`,
   `size`, `crc` (8 lower-case hex), `sha1` (40 lower-case hex or null
   for nodump), `archive`, `optional`, and `samples[]` with `name`,
   `archive`), plus `RomSetReport` exactly as §10.5 declares it. Every
   type has a predicate; `isRomSetMetadata` must reject a ROM whose
   `archive` is not in `archives`, duplicate archive names after case
   folding, and a `crc` that is not 8 hex digits.
2. **`RomSetAudit`** with a pure static `audit(metadata, roms: RomFile[]) → RomSetReport`
   and an instance form if you find one useful. It reads each zip's
   **central directory only** with `fflate`'s synchronous unzip-metadata
   path (`unzipSync` with a filter that rejects every entry is one way to
   get names, sizes and CRCs without inflating; say in a comment which
   `fflate` API you used and why it does not inflate). For each metadata
   ROM, find its archive among the supplied `RomFile`s by `romNameKey`,
   then the entry by case-insensitive name, then compare size and CRC32.
   Status rules are §10.5's: `ok`, `incomplete` (only missing archives or
   files, none wrong), `bad` (any present file with wrong size or CRC).
   `optional: true` ROMs and every `samples` entry report
   `optional-missing` and never affect status. `unexpected` lists zip
   entries no metadata ROM claims, informationally. The report never
   carries bytes.
3. **Zip safety.** A supplied archive that is not a zip, has a corrupt
   central directory, or exceeds 4,096 entries produces a report with
   that archive marked `present: true` and every ROM in it `missing`,
   plus a `problems: [{ archive, reason }]` field (add it to the report
   type; it is empty on a clean audit). Nothing throws for bad user
   input; `INVALID_CONFIG` is thrown only for metadata or `RomFile`
   values that fail their predicates.
4. **`scripts/audit-roms.ts`**: `arcade-audit-roms <romsets-dir> <machine> <zip>…`
   reads `<romsets-dir>/<machine>.json`, reads the zips from disk into
   `RomFile`s, runs the audit and prints the report as a table to stdout
   and as JSON with `--json`. Exit code 0 for `ok`, 2 for `incomplete`,
   3 for `bad`, 1 for usage or metadata errors. It copies nothing and
   writes nothing.
5. **Tests.** Build synthetic zips in the test with `fflate.zipSync`
   from random bytes and compute expected CRCs with `fflate`'s `crc32`
   (or a local implementation). Cases, each with exact expected report
   fields: complete split set (game + parent + bios) → `ok`; parent zip
   missing → `incomplete` naming the archive and its files; one file
   with the wrong CRC → `bad`; wrong size → `bad`; optional file missing
   → `ok` with `optional-missing`; sample zip missing → `ok`; extra file
   in a zip → `unexpected`; archive names matched case-insensitively; a
   non-zip buffer → `problems` entry and `incomplete`; metadata
   predicate rejections one per condition.

## 5. Contracts and doubles

From `src/shared.types.ts`: `RomFile`, `RomRole`, `RomName`,
`romNameKey`, `isRomFile`, `isRomRole`, `isRomName`, `NonEmptyString`.
From `tests/support/fixtures.ts`: `thrownBy`, `errorSnapshot`. `fflate` is
already a dependency; use only it for zip reading and for test zip
writing.

## 6. Definition of ready for review

`docs/work/README.md` rule 7. In addition, run the bin by hand against a
synthetic romsets directory and two synthetic zips and paste the table
output into the merge note so the integrator can see the shape.

## 7. Repository rules that bite here

- No real ROM metadata or content in tests or fixtures: machine names,
  file names and CRCs are all invented.
- The audit never inflates entries and never holds decompressed data.
- `scripts/audit-roms.ts` is the only ROM-touching script in the
  repository and it only reads.
- No attribution lines in commits.

## 8. Commands

```sh
npm install
npm run check
npm test
node --import tsx scripts/audit-roms.ts <romsets-dir> <machine> <zip>…
```
