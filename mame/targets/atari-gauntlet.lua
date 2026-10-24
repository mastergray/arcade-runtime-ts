---------------------------------------------------------------------------
--
--   atari-gauntlet.lua
--
--   MAME 0.161 Atari 68010 four-player family target.
--
---------------------------------------------------------------------------

CPUS["M6502"] = true
CPUS["M680X0"] = true

SOUNDS["YM2151"] = true
SOUNDS["POKEY"] = true
SOUNDS["TMS5220"] = true
SOUNDS["OKIM6295"] = true

MACHINES["EEPROMDEV"] = true
MACHINES["ER2055"] = true

-- The release-era generated project always archives the bus library, and its
-- pinned llvm-ar cannot create an empty archive. Keep one harmless bus core.
BUSES["CENTRONICS"] = true

_G["createProjects_mame_atari-gauntlet"] = function(_target, _subtarget)
	project ("mame_atari_gauntlet")
	targetsubdir(_target .. "_" .. _subtarget)
	kind "StaticLib"
	uuid (os.uuid("drv-mame-atari-gauntlet"))

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
		MAME_DIR .. "src/mame/drivers/gauntlet.c",
		MAME_DIR .. "src/mame/video/gauntlet.c",
		MAME_DIR .. "src/mame/machine/atarigen.c",
		MAME_DIR .. "src/mame/video/atarimo.c",
		MAME_DIR .. "src/mame/machine/slapstic.c",
	}
end

_G["linkProjects_mame_atari-gauntlet"] = function(_target, _subtarget)
	links {
		"mame_atari_gauntlet",
	}
end
