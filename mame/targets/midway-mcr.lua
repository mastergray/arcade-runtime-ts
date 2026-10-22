---------------------------------------------------------------------------
--
--   midway-mcr.lua
--
--   MAME 0.161 Midway MCR family target.
--
---------------------------------------------------------------------------

CPUS["Z80"] = true
CPUS["M6800"] = true
CPUS["M6809"] = true
CPUS["M680X0"] = true

SOUNDS["SAMPLES"] = true
SOUNDS["DAC"] = true
SOUNDS["AY8910"] = true
SOUNDS["YM2151"] = true
SOUNDS["TMS5220"] = true
SOUNDS["HC55516"] = true
SOUNDS["OKIM6295"] = true

MACHINES["6821PIA"] = true
MACHINES["Z80CTC"] = true
MACHINES["Z80DART"] = true
MACHINES["Z80PIO"] = true

-- The release-era generated project always archives the bus library, and its
-- pinned llvm-ar cannot create an empty archive. Keep one harmless bus core.
BUSES["CENTRONICS"] = true

_G["createProjects_mame_midway-mcr"] = function(_target, _subtarget)
	project ("mame_midway_mcr")
	targetsubdir(_target .. "_" .. _subtarget)
	kind "StaticLib"
	uuid (os.uuid("drv-mame-midway-mcr"))

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
		MAME_DIR .. "src/mame/drivers/mcr.c",
		MAME_DIR .. "src/mame/machine/mcr.c",
		MAME_DIR .. "src/mame/video/mcr.c",
		MAME_DIR .. "src/mame/drivers/mcr3.c",
		MAME_DIR .. "src/mame/video/mcr3.c",
		MAME_DIR .. "src/mame/drivers/mcr68.c",
		MAME_DIR .. "src/mame/machine/mcr68.c",
		MAME_DIR .. "src/mame/video/mcr68.c",
		MAME_DIR .. "src/mame/audio/midway.c",
		MAME_DIR .. "src/mame/audio/williams.c",
	}
end

_G["linkProjects_mame_midway-mcr"] = function(_target, _subtarget)
	links {
		"mame_midway_mcr",
	}
end
