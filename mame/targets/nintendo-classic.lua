---------------------------------------------------------------------------
--
--   nintendo-classic.lua
--
--   MAME 0.161 Nintendo classic family target.
--
---------------------------------------------------------------------------

CPUS["Z80"] = true
CPUS["S2650"] = true
CPUS["MCS48"] = true
CPUS["M6502"] = true

SOUNDS["DISCRETE"] = true
SOUNDS["NES_APU"] = true
SOUNDS["TMS5110"] = true

MACHINES["I8257"] = true
MACHINES["Z80DMA"] = true
MACHINES["TMS6100"] = true
MACHINES["EEPROMDEV"] = true

-- The release-era generated project always archives the bus library, and its
-- pinned llvm-ar cannot create an empty archive. Keep one harmless bus core.
BUSES["CENTRONICS"] = true

_G["createProjects_mame_nintendo-classic"] = function(_target, _subtarget)
	project ("mame_nintendo_classic")
	targetsubdir(_target .. "_" .. _subtarget)
	kind "StaticLib"
	uuid (os.uuid("drv-mame-nintendo-classic"))

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
		MAME_DIR .. "src/mame/drivers/dkong.c",
		MAME_DIR .. "src/mame/audio/dkong.c",
		MAME_DIR .. "src/mame/video/dkong.c",
	}
end

_G["linkProjects_mame_nintendo-classic"] = function(_target, _subtarget)
	links {
		"mame_nintendo_classic",
	}
end
