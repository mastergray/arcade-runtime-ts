---------------------------------------------------------------------------
--
--   nintendo-vs.lua
--
--   MAME 0.161 Nintendo VS. System family target.
--
---------------------------------------------------------------------------

CPUS["M6502"] = true
CPUS["Z80"] = true

SOUNDS["NES_APU"] = true
SOUNDS["SN76496"] = true
SOUNDS["DAC"] = true

MACHINES["RP5H01"] = true

-- The release-era generated project always archives the bus library, and its
-- pinned llvm-ar cannot create an empty archive. Keep one harmless bus core.
BUSES["CENTRONICS"] = true

_G["createProjects_mame_nintendo-vs"] = function(_target, _subtarget)
	project ("mame_nintendo_vs")
	targetsubdir(_target .. "_" .. _subtarget)
	kind "StaticLib"
	uuid (os.uuid("drv-mame-nintendo-vs"))

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
		MAME_DIR .. "src/mame/drivers/vsnes.c",
		MAME_DIR .. "src/mame/machine/vsnes.c",
		MAME_DIR .. "src/mame/video/vsnes.c",
		MAME_DIR .. "src/mame/video/ppu2c0x.c",
	}
end

_G["linkProjects_mame_nintendo-vs"] = function(_target, _subtarget)
	links {
		"mame_nintendo_vs",
	}
end
