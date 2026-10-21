# P1: source identity, native baseline and licence

Status: pass.

## Official source identity

The candidate source is the official annotated MAME tag `mame0161`. An
independent remote lookup returned tag object
`e86fa8bcf4430937777d7a384f8ea7b9a01569ab`, which peels to commit
`76b978d039f922ed84796deb999389ebb1579191`. MAME's previous-release index
dates 0.161 to 2015-04-29, and the official
[SourceForge release directory](https://sourceforge.net/projects/mame/files/mame/0.161/)
lists the source packages for that date.

The immutable tag and commit are recorded in
[`mame/SOURCE.json`](../../../mame/SOURCE.json).

The user-supplied `mame0161s.zip` is kept under ignored `res/`. Its only
member is the 2015-04-29 `mame.zip` source payload. Both archive layers pass
complete zip integrity checks, and the inner archive contains 17,056 entries.
The extracted files were compared directly with a clean checkout of the
official tag:

| Tree comparison | Result |
| --------------- | ------ |
| Files tracked by the tag | 16,068 |
| Missing from the source package | 0 |
| Different from the tagged file | 0 |
| Extra package files | 0 |

This byte-for-byte tracked-tree equality authenticates the package without
recording a hash of the local `res/` input. It also confirms the inspected
`BARE_BUILD_VERSION`, historical licence, release-era `asmjs` target and
`tiny` subtarget came from the pinned official source rather than merely a
self-consistent archive.

## Source-built native baseline

The authenticated source produced a native Linux `tiny` executable. Its
`-help`, `-listfull`, `-listsource` and `-listxml` commands all exited zero and
agree on version 0.161, the 25 runnable machines in the subset and their
source/XML relationships. Commands, counts and the newer-host allocator
diagnostic are recorded in [native-cli.md](native-cli.md).

P1 deliberately does not require a separately compiled Windows executable.
The official tagged tree establishes provenance, while the source-built
native executable establishes behavior for the exact subset being ported.
A platform compatibility layer would add no independent source or subset
evidence.

## Historical licence finding

The authenticated package contains the historical MAME licence in
`docs/license.txt`, not the GPL/BSD terms displayed by current MAME releases.
Its distribution conditions include all of the following:

- redistributions may not be sold or used in a commercial product or
  activity;
- a redistribution modified from the original source must include the
  complete corresponding source, subject to the stated operating-system
  component exception;
- the copyright notice, conditions and disclaimer must accompany a
  redistribution.

This aligns with MAMEdev's later
[relicensing record](https://github.com/mamedev/mame/issues/562), which
describes the then-current custom licence as prohibiting commercial use. The
relicensing effort occurred after 0.161 and does not replace the licence
attached to this release.

The release also carries file-level `BSD-3-Clause`, `GPL-2.0+`, `LGPL-2.1+`
and `MAME` identifiers in `docs/licenseinfo.txt`. Those notices remain part of
the corresponding-source obligation.

## Separately licensed linked components

The generated `mametiny` link target names the following bundled static
archives. This inventory is intentionally conservative: a library remains in
the notice set even if a later optimized build removes all of its code.

| Component | Terms recorded in the pinned tree | Notice source |
| --------- | --------------------------------- | ------------- |
| Expat | MIT-style permission notice | `3rdparty/expat/COPYING` |
| SoftFloat | Upstream permissive/custom notice, including documentation and indemnity conditions | `3rdparty/softfloat/README.txt` |
| IJG JPEG | IJG redistribution terms | `3rdparty/libjpeg/README` |
| FLAC | Xiph BSD-style licence for the linked library | `3rdparty/libflac/COPYING.Xiph` |
| LZMA SDK / 7z code | Public domain | `3rdparty/lzma/7zC.txt` |
| Lua 5.3 | MIT | `3rdparty/lua/src/lua.h` |
| LuaSQLite3 | MIT | `3rdparty/lsqlite3/lsqlite3.c` |
| SQLite3 | Public-domain dedication | `3rdparty/sqlite3/sqlite3.h` |
| zlib | zlib licence | `3rdparty/zlib/zlib.h` |
| JsonCpp | Public domain or MIT | `3rdparty/jsoncpp/LICENSE` |

Mongoose is present in the upstream tree but is not a browser-build input.
[`0005-emscripten-disable-mongoose.patch`](../../../mame/probes/patches/0005-emscripten-disable-mongoose.patch)
replaces the internal web server with no-op Emscripten stubs and removes the
Mongoose archive from the asmjs link; the runtime does not support MAME's
unneeded `-http` feature. A rebuilt `mametiny.bc` has no Mongoose archive
dependency and no `mg_*` or `ns_*` symbols.

The browser build additionally incorporates the pinned toolchain runtime and
SDL2 port. Emscripten 1.38.31 carries MIT/NCSA notices and its SDL2 port carries
the SDL zlib-style notice; their licence files must also be copied into a
distributed build's notice bundle.

## Distribution gate

P1 passes because the source identity, native comparison baseline and
applicable notice set are now known. Passing P1 is not permission to publish a
binary. The MIT-licensed TypeScript/npm runtime remains separate from generated
MAME artifacts, which are not relicensed. The project must
continue to keep prebuilt 0.161 artifacts out of the npm package and default
build and preserve complete corresponding source and required notices for any
permitted non-commercial MAME distribution. The production builder must name
and copy the final notice set from its measured link inputs.
