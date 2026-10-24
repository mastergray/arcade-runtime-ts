---------------------------------------------------------------------------
--
--   sega-s32.lua
--
--   MAME 0.161 Sega System 32/Multi 32 family target.
--
---------------------------------------------------------------------------

CPUS["Z80"] = true
CPUS["NEC"] = true
CPUS["V60"] = true

SOUNDS["YM2612"] = true
SOUNDS["YM3438"] = true
SOUNDS["MULTIPCM"] = true
SOUNDS["RF5C68"] = true

MACHINES["EEPROMDEV"] = true

-- The release-era generated project always archives the bus library, and its
-- pinned llvm-ar cannot create an empty archive. Keep one harmless bus core.
BUSES["CENTRONICS"] = true

_G["createProjects_mame_sega-s32"] = function(_target, _subtarget)
	project ("mame_sega_s32")
	targetsubdir(_target .. "_" .. _subtarget)
	kind "StaticLib"
	uuid (os.uuid("drv-mame-sega-s32"))

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
		MAME_DIR .. "src/mame/drivers/segas32.c",
		MAME_DIR .. "src/mame/machine/segas32.c",
		MAME_DIR .. "src/mame/video/segas32.c",
		MAME_DIR .. "src/mame/machine/315_5296.c",
	}
end

_G["linkProjects_mame_sega-s32"] = function(_target, _subtarget)
	links {
		"mame_sega_s32",
	}
end
