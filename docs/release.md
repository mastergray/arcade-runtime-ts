# v1.0.0 release procedure

This procedure gates a release of the TypeScript runtime. It does not turn the
developer harness into a deployment and it does not authorize distribution of
third-party emulator or game content.

## Release inputs

Run the gate from a clean checkout with Node.js 22.13 or newer, npm, the pinned
Emscripten 1.38.31 SDK, the authenticated MAME 0.161 source archive and the
private, ignored browser-test configurations available to the release
operator. The configurations must cover every required family and the lawful
local sets used for the §14.1 acceptance flows. Their paths and contents are
release-machine inputs and must not be copied into a log, commit or artifact.

Install the JavaScript dependencies and confirm that no tracked or untracked
release output is already present:

```sh
npm install
git status --short
```

Stop if the checkout is not clean. Release evidence must come from the tagged
tree, not from local edits.

## Build every required family

Build the complete committed family matrix from a fresh unpack of the pinned
source:

```sh
node --import tsx scripts/build-mame.ts --all --fresh
```

Do not reuse a previously patched source tree for release evidence. The
command must finish for every `mame/builds/*.json` entry. For each generated
family directory, retain the command's machine count, WebAssembly byte size,
ROM-set count and build identifier in the private release record. Confirm that
`build.json` validates, every named artifact exists, every named notice exists,
there is one valid ROM-set metadata file per reported machine, and the
threading inspector reports fixed, non-shared memory. The ordinary spec suite
performs these checks over every family output it discovers.

Each build's `notices/` directory must contain the complete P1 set, including
the historical MAME and file-level licence records, linked third-party library
notices, the Emscripten notice and the SDL2 notice. A separately distributed
family build must keep this directory beside its JavaScript and WebAssembly
artifacts and must provide complete corresponding source as the historical
MAME licence requires.

## Automated gates

Run the source and spec gates after all family builds exist:

```sh
npm run check
npm test
```

Then provide the ignored private configuration values through the environment
and run the browser suite:

```sh
ARCADE_PRELOAD_CONFIG="$ARCADE_RELEASE_PRELOAD_CONFIG" \
ARCADE_FAMILY_CONFIGS="$ARCADE_RELEASE_FAMILY_CONFIGS" \
npm run test:browser
```

The release operator supplies `ARCADE_RELEASE_PRELOAD_CONFIG` and
`ARCADE_RELEASE_FAMILY_CONFIGS`; they are not repository defaults. A tagged
release may not treat a missing artifact or private configuration as an
acceptable skip.

In the browser results, explicitly retain the output from:

- `30-m1-acceptance.test.ts`, for the M1 clean-build, native-size and cadence
  acceptance;
- `33-family-measurements.test.ts`, for startup and 60-second pacing evidence
  from every required family; and
- `36-input-audio-acceptance.test.ts`, for the M3 audio, M4 keyboard and M5
  two-gamepad acceptance cases.

Record the family size, memory, startup and pacing measurements alongside the
release, without recording any private set identity, archive hash or local
path.

## Desktop acceptance walkthrough

Serve the harness only on the release machine and exercise all ten §14.1
flows. The walkthrough must show:

1. every required family reporting the pinned MAME 0.161 runtime identity;
2. equivalent preload and file-picker starts producing the same machine
   description and first stable frame;
3. a missing parent, BIOS or optional sample report becoming startable after
   the user supplies the missing archive;
4. coin, start and play from a physical keyboard on both zero-button vertical
   hardware and six-button hardware;
5. independent input from two standard gamepads and complete held-input
   release on disconnect;
6. synchronized stereo after one user gesture with the 60-second queue cap
   satisfied;
7. memory-card, EEPROM and named-state restoration after reload, followed by
   clearing saves without clearing the ROM store;
8. BIOS region and arcade/home-system switching without a rebuild;
9. actionable pre-start reports for wrong-version, incomplete, clone-only and
   wrong-family inputs; and
10. clean recovery from every asynchronous startup boundary, leaving an idle,
    reusable player with no leaked session or browser resources.

The harness, its preload configuration and all user-supplied files remain
local throughout this walkthrough.

## Package and tag

Build the publishable package in a clean release checkout, inspect the dry-run
listing, then create the tarball:

```sh
npm run build:package
npm pack --dry-run
npm pack
```

The listing must contain the compiled library and declarations, TypeScript
sources, `scripts/audit-roms.ts` and its runtime imports, `LICENSE`, `README.md`
and `package.json`. It must contain none of `res/`, `harness/`, `tests/`, probe
records, caches, `mame/probes/`, `dist/mame/`, WebAssembly, ROM archives,
bitcode or static archives. Install the tarball into an empty temporary
consumer directory and run `arcade-audit-roms` against a generated synthetic
ROM-set fixture before creating and pushing the `v1.0.0` tag.

## Distribution and hosted-harness decision

The v1.0.0 release publishes only the MIT-licensed TypeScript npm package. The
npm package never contains a MAME build, a ROM, or an emulator notice bundle.
The project does not publish the family builds as separate v1.0.0 release
assets. They remain consumer-built, consumer-hosted artifacts governed by
MAME 0.161's historical licence, with the complete P1 notice set served beside
them and corresponding source supplied when the licence requires it.

The developer harness is excluded from npm and is not a public hosted demo. It
must never be hosted publicly with ROMs, BIOS sets, sample sets or a private
preload configuration. A page built by a consumer remains responsible for its
own hosting and for obtaining lawful files from its own user at run time.

## Emulator-artifact licence review

Decision for v1.0.0: **do not publish family builds separately**. The npm
runtime may be released only after the reviewer confirms that the package is
separate from generated MAME artifacts and that the build-output procedure
preserves every required notice. Any future proposal to distribute a family
artifact reopens review of the pinned source, patches, complete corresponding
source offer and distribution method before publication.

- Reviewer: **to be completed by the release owner**
- Review date: **to be completed by the release owner**
- Final approval or exception notes: **to be completed by the release owner**

Do not tag or publish until these fields are completed.
