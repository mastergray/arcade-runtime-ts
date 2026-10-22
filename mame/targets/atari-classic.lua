---------------------------------------------------------------------------
--
--   atari-classic.lua
--
--   MAME 0.161 Atari classic family target.
--
---------------------------------------------------------------------------

CPUS["M6502"] = true
CPUS["M680X0"] = true

SOUNDS["DISCRETE"] = true
SOUNDS["POKEY"] = true
SOUNDS["YM2413"] = true
SOUNDS["OKIM6295"] = true

-- The release-era generated project always archives the bus library, and its
-- pinned llvm-ar cannot create an empty archive. Keep one harmless bus core.
BUSES["CENTRONICS"] = true

_G["createProjects_mame_atari-classic"] = function(_target, _subtarget)
	project ("mame_atari_classic")
	targetsubdir(_target .. "_" .. _subtarget)
	kind "StaticLib"
	uuid (os.uuid("drv-mame-atari-classic"))

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
		MAME_DIR .. "src/mame/drivers/bzone.c",
		MAME_DIR .. "src/mame/audio/bzone.c",
		MAME_DIR .. "src/mame/drivers/tempest.c",
		MAME_DIR .. "src/mame/drivers/rampart.c",
		MAME_DIR .. "src/mame/video/rampart.c",

		MAME_DIR .. "src/mame/video/avgdvg.c",
		MAME_DIR .. "src/mame/machine/atari_vg.c",
		MAME_DIR .. "src/mame/machine/mathbox.c",
		MAME_DIR .. "src/mame/audio/redbaron.c",
		MAME_DIR .. "src/mame/machine/atarigen.c",
		MAME_DIR .. "src/mame/video/atarimo.c",
		MAME_DIR .. "src/mame/machine/slapstic.c",
	}
end

_G["linkProjects_mame_atari-classic"] = function(_target, _subtarget)
	links {
		"mame_atari_classic",
	}
end
