# P1: source identity, native reference and licence

Status: partial.

## Official source identity

The candidate source is the official MAME release tag `mame0161`, resolving to
commit `76b978d039f922ed84796deb999389ebb1579191` in
[`mamedev/mame`](https://github.com/mamedev/mame/releases/tag/mame0161).
MAME's previous-release index dates 0.161 to 2015-04-29, and the official
[SourceForge release directory](https://sourceforge.net/projects/mame/files/mame/0.161/)
lists both `mame0161s.exe`/`mame0161s.zip` source packages and the
`mame0161b_64bit.exe` Windows package for that date.

The immutable build input is recorded in [`mame/SOURCE.json`](../../../mame/SOURCE.json).

The user-supplied `mame0161s.zip` is kept under ignored `res/`. Its only member
is the 2015-04-29 `mame.zip` source payload. Both archive layers pass complete
zip integrity checks, and the inner archive contains 17,056 entries. Direct
inspection of the extracted payload confirms all of the following:

- `src/version.c` defines `BARE_BUILD_VERSION` as `0.161`;
- `docs/license.txt` contains the historical MAME licence described below;
- the root makefile contains the release-era `asmjs` build target;
- the expected 0.161 source layout, including the `tiny` subtarget definition,
  is present.

This makes the package internally consistent with the official 0.161 source
release. A byte/tree comparison with commit
`76b978d039f922ed84796deb999389ebb1579191`, or an independently published
official checksum, is still required to authenticate the local bytes. No
checksum of the local `res/` input is committed, in accordance with §0.3 of
the runtime specification.

## Local native reference

Static inspection of the user-supplied `mame0161b_64bit.exe` established:

- the outer file is a self-extracting Windows archive containing a 7-Zip
  payload;
- the payload contains 221 entries, including `mame64.exe`, `whatsnew.txt`,
  `docs/license.txt` and `docs/licenseinfo.txt`;
- the extracted `mame64.exe` is a PE32+ x86-64 console executable whose version
  resources report `FileVersion 0, 161, 0, 0` and `ProductVersion 0.161`;
- the bundled `whatsnew.txt` begins with version `0.161`.

No local binary or ROM hash is recorded in source, in accordance with §0.3 of
the runtime specification. These observations make the reference consistent
with the official package, but an official checksum or byte-for-byte package
comparison is still needed to authenticate it.

The Windows reference's `-help`, `-listfull`, `-listsource` and `-listxml`
baselines remain pending because this host has neither Wine nor a Windows
execution environment. The corresponding source-built `tiny` commands now
have a baseline in [native-cli.md](native-cli.md).

## Historical licence finding

Both the previously inspected native reference and the newly inspected source
package contain the same historical MAME licence in `docs/license.txt`, not
the GPL/BSD terms displayed by current MAME releases. Its distribution
conditions include all of the following:

- redistributions may not be sold or used in a commercial product or activity;
- a redistribution modified from the original source must include the complete
  corresponding source, subject to the stated operating-system-component
  exception;
- the copyright notice, conditions and disclaimer must accompany a
  redistribution.

This aligns with MAMEdev's later
[relicensing record](https://github.com/mamedev/mame/issues/562), which
explicitly describes the then-current custom licence as prohibiting commercial
use. The relicensing effort occurred after 0.161 and does not by itself replace
the licence attached to this historical release.

Consequences for this project:

1. Keep the npm package and default build free of a prebuilt 0.161 emulator.
2. Do not publish, sell or use a 0.161-derived browser binary commercially.
3. Any permitted distribution of a modified 0.161 build must carry the
   required notice and complete corresponding source.
4. A later, relicensed MAME tag may be evaluated if the intended deployment
   requires commercial use, but that is an explicit version/ROM migration
   decision rather than a silent source substitution.

The final P1 record must identify any separately licensed bundled components
used by the selected subset.

## Remaining P1 work

- Verify the tag commit and compare the packaged source with the tagged tree.
- Record the source package checksum from an independent official channel when
  one is available.
- Run the Windows native reference's four metadata commands.
- Compare its version, machine names, source mappings and XML metadata with the
  recorded source-built native output and the future browser executable.
