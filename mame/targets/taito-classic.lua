---------------------------------------------------------------------------
--
--   taito-classic.lua
--
--   MAME 0.161 Taito classic family target.
--
---------------------------------------------------------------------------

CPUS["Z80"] = true
CPUS["M6800"] = true
CPUS["M6805"] = true
CPUS["M6809"] = true
CPUS["MCS48"] = true
CPUS["MCS51"] = true

SOUNDS["SAMPLES"] = true
SOUNDS["DAC"] = true
SOUNDS["AY8910"] = true
SOUNDS["YM2151"] = true
SOUNDS["YM2203"] = true
SOUNDS["YM3526"] = true
SOUNDS["MSM5205"] = true
SOUNDS["MSM5232"] = true
SOUNDS["SN76496"] = true

MACHINES["BANKDEV"] = true

-- The release-era generated project always archives the bus library, and its
-- pinned llvm-ar cannot create an empty archive. Keep one harmless bus core.
BUSES["CENTRONICS"] = true

_G["createProjects_mame_taito-classic"] = function(_target, _subtarget)
	project ("mame_taito_classic")
	targetsubdir(_target .. "_" .. _subtarget)
	kind "StaticLib"
	uuid (os.uuid("drv-mame-taito-classic"))

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
		MAME_DIR .. "src/mame/drivers/taitosj.c",
		MAME_DIR .. "src/mame/machine/taitosj.c",
		MAME_DIR .. "src/mame/video/taitosj.c",
		MAME_DIR .. "src/mame/drivers/bublbobl.c",
		MAME_DIR .. "src/mame/machine/bublbobl.c",
		MAME_DIR .. "src/mame/video/bublbobl.c",
		MAME_DIR .. "src/mame/drivers/arkanoid.c",
		MAME_DIR .. "src/mame/machine/arkanoid.c",
		MAME_DIR .. "src/mame/video/arkanoid.c",
		MAME_DIR .. "src/mame/drivers/tnzs.c",
		MAME_DIR .. "src/mame/machine/tnzs.c",
		MAME_DIR .. "src/mame/video/tnzs.c",
		MAME_DIR .. "src/mame/video/seta001.c",
		MAME_DIR .. "src/mame/drivers/slapfght.c",
		MAME_DIR .. "src/mame/machine/slapfght.c",
		MAME_DIR .. "src/mame/video/slapfght.c",
		MAME_DIR .. "src/mame/drivers/flstory.c",
		MAME_DIR .. "src/mame/machine/flstory.c",
		MAME_DIR .. "src/mame/video/flstory.c",
		MAME_DIR .. "src/mame/drivers/lkage.c",
		MAME_DIR .. "src/mame/machine/lkage.c",
		MAME_DIR .. "src/mame/video/lkage.c",
		MAME_DIR .. "src/mame/drivers/retofinv.c",
		MAME_DIR .. "src/mame/machine/retofinv.c",
		MAME_DIR .. "src/mame/video/retofinv.c",
		MAME_DIR .. "src/mame/drivers/nycaptor.c",
		MAME_DIR .. "src/mame/machine/nycaptor.c",
		MAME_DIR .. "src/mame/video/nycaptor.c",
		MAME_DIR .. "src/mame/drivers/buggychl.c",
		MAME_DIR .. "src/mame/machine/buggychl.c",
		MAME_DIR .. "src/mame/video/buggychl.c",
		MAME_DIR .. "src/mame/drivers/gladiatr.c",
		MAME_DIR .. "src/mame/machine/tait8741.c",
		MAME_DIR .. "src/mame/video/gladiatr.c",
		MAME_DIR .. "src/mame/drivers/mexico86.c",
		MAME_DIR .. "src/mame/machine/mexico86.c",
		MAME_DIR .. "src/mame/video/mexico86.c",
		MAME_DIR .. "src/mame/drivers/superqix.c",
		MAME_DIR .. "src/mame/video/superqix.c",
	}
end

_G["linkProjects_mame_taito-classic"] = function(_target, _subtarget)
	links {
		"mame_taito_classic",
	}
end
