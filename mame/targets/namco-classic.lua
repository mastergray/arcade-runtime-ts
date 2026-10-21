---------------------------------------------------------------------------
--
--   namco-classic.lua
--
--   MAME 0.161 Namco classic family target.
--
---------------------------------------------------------------------------

CPUS["Z80"] = true
CPUS["S2650"] = true
CPUS["M6800"] = true
CPUS["M6809"] = true
CPUS["M680X0"] = true
CPUS["Z8000"] = true
CPUS["MB88XX"] = true

SOUNDS["SAMPLES"] = true
SOUNDS["DAC"] = true
SOUNDS["DISCRETE"] = true
SOUNDS["AY8910"] = true
SOUNDS["SN76496"] = true
SOUNDS["NAMCO"] = true
SOUNDS["NAMCO_15XX"] = true
SOUNDS["NAMCO_CUS30"] = true
SOUNDS["TMS5220"] = true
SOUNDS["DIGITALKER"] = true

MACHINES["I8255"] = true

-- The release-era generated project always archives the bus library, and its
-- pinned llvm-ar cannot create an empty archive. Keep one harmless bus core.
BUSES["CENTRONICS"] = true

_G["createProjects_mame_namco-classic"] = function(_target, _subtarget)
	project ("mame_namco_classic")
	targetsubdir(_target .. "_" .. _subtarget)
	kind "StaticLib"
	uuid (os.uuid("drv-mame-namco-classic"))

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
		MAME_DIR .. "src/mame/drivers/pacman.c",
		MAME_DIR .. "src/mame/video/pacman.c",
		MAME_DIR .. "src/mame/machine/acitya.c",
		MAME_DIR .. "src/mame/machine/jumpshot.c",
		MAME_DIR .. "src/mame/machine/pacplus.c",
		MAME_DIR .. "src/mame/machine/theglobp.c",

		MAME_DIR .. "src/mame/drivers/galaga.c",
		MAME_DIR .. "src/mame/audio/galaga.c",
		MAME_DIR .. "src/mame/video/galaga.c",
		MAME_DIR .. "src/mame/video/bosco.c",
		MAME_DIR .. "src/mame/video/digdug.c",
		MAME_DIR .. "src/mame/machine/xevious.c",
		MAME_DIR .. "src/mame/video/xevious.c",
		MAME_DIR .. "src/mame/machine/atari_vg.c",

		MAME_DIR .. "src/mame/drivers/galaxian.c",
		MAME_DIR .. "src/mame/audio/galaxian.c",
		MAME_DIR .. "src/mame/video/galaxian.c",
		MAME_DIR .. "src/mame/audio/cclimber.c",

		MAME_DIR .. "src/mame/drivers/rallyx.c",
		MAME_DIR .. "src/mame/video/rallyx.c",
		MAME_DIR .. "src/mame/audio/timeplt.c",

		MAME_DIR .. "src/mame/drivers/mappy.c",
		MAME_DIR .. "src/mame/video/mappy.c",
		MAME_DIR .. "src/mame/drivers/toypop.c",
		MAME_DIR .. "src/mame/video/toypop.c",
		MAME_DIR .. "src/mame/drivers/gaplus.c",
		MAME_DIR .. "src/mame/machine/gaplus.c",
		MAME_DIR .. "src/mame/video/gaplus.c",
		MAME_DIR .. "src/mame/drivers/skykid.c",
		MAME_DIR .. "src/mame/video/skykid.c",
		MAME_DIR .. "src/mame/drivers/baraduke.c",
		MAME_DIR .. "src/mame/video/baraduke.c",
		MAME_DIR .. "src/mame/drivers/pacland.c",
		MAME_DIR .. "src/mame/video/pacland.c",
		MAME_DIR .. "src/mame/drivers/polepos.c",
		MAME_DIR .. "src/mame/audio/polepos.c",
		MAME_DIR .. "src/mame/video/polepos.c",

		MAME_DIR .. "src/mame/machine/namcoio.c",
		MAME_DIR .. "src/mame/machine/namco06.c",
		MAME_DIR .. "src/mame/machine/namco50.c",
		MAME_DIR .. "src/mame/machine/namco51.c",
		MAME_DIR .. "src/mame/machine/namco53.c",
		MAME_DIR .. "src/mame/machine/namco62.c",
		MAME_DIR .. "src/mame/audio/namco52.c",
		MAME_DIR .. "src/mame/audio/namco54.c",
	}
end

_G["linkProjects_mame_namco-classic"] = function(_target, _subtarget)
	links {
		"mame_namco_classic",
	}
end
