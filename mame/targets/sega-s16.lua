---------------------------------------------------------------------------
--
--   sega-s16.lua
--
--   MAME 0.161 Sega System 16/18 family target.
--
---------------------------------------------------------------------------

CPUS["Z80"] = true
CPUS["MCS48"] = true
CPUS["MCS51"] = true
CPUS["M680X0"] = true

SOUNDS["DAC"] = true
SOUNDS["YM2151"] = true
SOUNDS["YM2413"] = true
SOUNDS["YM2612"] = true
SOUNDS["YM3438"] = true
SOUNDS["UPD7759"] = true
SOUNDS["RF5C68"] = true
SOUNDS["SN76496"] = true

VIDEOS["SEGA315_5313"] = true

MACHINES["I8243"] = true
MACHINES["I8255"] = true

-- The release-era generated project always archives the bus library, and its
-- pinned llvm-ar cannot create an empty archive. Keep one harmless bus core.
BUSES["CENTRONICS"] = true

_G["createProjects_mame_sega-s16"] = function(_target, _subtarget)
	project ("mame_sega_s16")
	targetsubdir(_target .. "_" .. _subtarget)
	kind "StaticLib"
	uuid (os.uuid("drv-mame-sega-s16"))

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
		MAME_DIR .. "src/mame/drivers/segas16a.c",
		MAME_DIR .. "src/mame/video/segas16a.c",
		MAME_DIR .. "src/mame/drivers/segas16b.c",
		MAME_DIR .. "src/mame/video/segas16b.c",
		MAME_DIR .. "src/mame/drivers/segas18.c",
		MAME_DIR .. "src/mame/video/segas18.c",

		MAME_DIR .. "src/mame/machine/315_5296.c",
		MAME_DIR .. "src/mame/machine/fd1089.c",
		MAME_DIR .. "src/mame/machine/fd1094.c",
		MAME_DIR .. "src/mame/machine/mc8123.c",
		MAME_DIR .. "src/mame/machine/segacrpt.c",
		MAME_DIR .. "src/mame/machine/segacrp2.c",
		MAME_DIR .. "src/mame/machine/segaic16.c",
		MAME_DIR .. "src/mame/video/segaic16.c",
		MAME_DIR .. "src/mame/video/segaic16_road.c",
		MAME_DIR .. "src/mame/video/sega16sp.c",
	}
end

_G["linkProjects_mame_sega-s16"] = function(_target, _subtarget)
	links {
		"mame_sega_s16",
	}
end
