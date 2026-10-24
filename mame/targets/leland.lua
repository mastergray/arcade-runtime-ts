---------------------------------------------------------------------------
--
--   leland.lua
--
--   MAME 0.161 Leland family target.
--
---------------------------------------------------------------------------

CPUS["Z80"] = true
CPUS["I86"] = true

SOUNDS["AY8910"] = true
SOUNDS["DAC"] = true
SOUNDS["YM2151"] = true

MACHINES["EEPROMDEV"] = true
MACHINES["PIT8253"] = true

-- The release-era generated project always archives the bus library, and its
-- pinned llvm-ar cannot create an empty archive. Keep one harmless bus core.
BUSES["CENTRONICS"] = true

function createProjects_mame_leland(_target, _subtarget)
	project ("mame_leland")
	targetsubdir(_target .. "_" .. _subtarget)
	kind "StaticLib"
	uuid (os.uuid("drv-mame-leland"))

	options {
		"ForceCPP",
	}

	includedirs {
		MAME_DIR .. "src/osd",
		MAME_DIR .. "src/emu",
		MAME_DIR .. "src/mame",
		MAME_DIR .. "src/lib",
		MAME_DIR .. "src/lib/util",
		MAME_DIR .. "3rdparty",
		MAME_DIR .. "3rdparty/zlib",
		GEN_DIR .. "mame/layout",
	}

	files {
		MAME_DIR .. "src/mame/drivers/leland.c",
		MAME_DIR .. "src/mame/machine/leland.c",
		MAME_DIR .. "src/mame/audio/leland.c",
		MAME_DIR .. "src/mame/video/leland.c",
	}
end

function linkProjects_mame_leland(_target, _subtarget)
	links {
		"mame_leland",
	}
end
