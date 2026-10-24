---------------------------------------------------------------------------
--
--   sega-16.lua
--
--   MAME 0.161 Sega 16-bit family target.
--
---------------------------------------------------------------------------

CPUS["Z80"] = true
CPUS["MCS51"] = true
CPUS["M680X0"] = true

SOUNDS["YM2151"] = true
SOUNDS["YM2203"] = true
SOUNDS["SEGAPCM"] = true

MACHINES["I8255"] = true
MACHINES["MB8421"] = true

-- The release-era generated project always archives the bus library, and its
-- pinned llvm-ar cannot create an empty archive. Keep one harmless bus core.
BUSES["CENTRONICS"] = true

_G["createProjects_mame_sega-16"] = function(_target, _subtarget)
	project ("mame_sega_16")
	targetsubdir(_target .. "_" .. _subtarget)
	kind "StaticLib"
	uuid (os.uuid("drv-mame-sega-16"))

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
		MAME_DIR .. "src/mame/drivers/segahang.c",
		MAME_DIR .. "src/mame/video/segahang.c",
		MAME_DIR .. "src/mame/drivers/segaorun.c",
		MAME_DIR .. "src/mame/video/segaorun.c",
		MAME_DIR .. "src/mame/drivers/segaxbd.c",
		MAME_DIR .. "src/mame/video/segaxbd.c",
		MAME_DIR .. "src/mame/drivers/segaybd.c",
		MAME_DIR .. "src/mame/video/segaybd.c",

		MAME_DIR .. "src/mame/machine/segaic16.c",
		MAME_DIR .. "src/mame/video/segaic16.c",
		MAME_DIR .. "src/mame/video/segaic16_road.c",
		MAME_DIR .. "src/mame/video/sega16sp.c",
		MAME_DIR .. "src/mame/machine/fd1089.c",
		MAME_DIR .. "src/mame/machine/fd1094.c",
	}
end

_G["linkProjects_mame_sega-16"] = function(_target, _subtarget)
	links {
		"mame_sega_16",
	}
end
