# MAME 0.161 family targets

Each family is a committed `<family>.lua` + `<family>.lst` pair. The Lua file
selects the cores and compilation units; the list exposes every public parent,
clone and required BIOS root defined by those driver units. Copy both files to
the same relative locations in the pinned source tree and build with
`SUBTARGET=<family>`.

The first comment in each `.lst` records its derivation command. Run it from
the MAME source root. It extracts the machine argument from the driver macros,
sorts and de-duplicates the names, and filters them against `src/mame/mame.lst`.
Neo Geo also includes `CONS`, because 0.161 declares the family's required BIOS
root with that macro. The source annotation after each entry is a list-format
comment and lets repository tests verify that the paired Lua compiles the unit
which defines it.

Family targets always contain the complete public family list. They contain no
private machine selection, ROM identity, hash, or local path.
