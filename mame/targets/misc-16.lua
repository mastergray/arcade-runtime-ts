---------------------------------------------------------------------------
--
--   misc-16.lua
--
--   MAME 0.161 mixed 16-bit arcade family target.
--
---------------------------------------------------------------------------

CPUS["Z80"] = true
CPUS["M6502"] = true
CPUS["H6280"] = true
CPUS["NEC"] = true
CPUS["MCS51"] = true
CPUS["M6809"] = true
CPUS["M680X0"] = true
CPUS["TMS32010"] = true
CPUS["TMS340X0"] = true

SOUNDS["YM2151"] = true
SOUNDS["YM2203"] = true
SOUNDS["YM3526"] = true
SOUNDS["YM3812"] = true
SOUNDS["MSM5205"] = true
SOUNDS["OKIM6295"] = true
SOUNDS["BSMT2000"] = true

VIDEOS["BUFSPRITE"] = true
VIDEOS["TLC34076"] = true

MACHINES["BANKDEV"] = true
MACHINES["EEPROMDEV"] = true

-- The release-era generated project always archives the bus library, and its
-- pinned llvm-ar cannot create an empty archive. Keep one harmless bus core.
BUSES["CENTRONICS"] = true

_G["createProjects_mame_misc-16"] = function(_target, _subtarget)
	project ("mame_misc_16")
	targetsubdir(_target .. "_" .. _subtarget)
	kind "StaticLib"
	uuid (os.uuid("drv-mame-misc-16"))

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
		MAME_DIR .. "src/mame/drivers/dec0.c",
		MAME_DIR .. "src/mame/machine/dec0.c",
		MAME_DIR .. "src/mame/video/dec0.c",
		MAME_DIR .. "src/mame/drivers/karnov.c",
		MAME_DIR .. "src/mame/video/karnov.c",
		MAME_DIR .. "src/mame/video/decbac06.c",
		MAME_DIR .. "src/mame/video/decmxc06.c",
		MAME_DIR .. "src/mame/video/deckarn.c",
		MAME_DIR .. "src/mame/drivers/cninja.c",
		MAME_DIR .. "src/mame/video/cninja.c",
		MAME_DIR .. "src/mame/machine/deco146.c",
		MAME_DIR .. "src/mame/video/deco16ic.c",
		MAME_DIR .. "src/mame/video/decocomn.c",
		MAME_DIR .. "src/mame/video/decospr.c",

		MAME_DIR .. "src/mame/drivers/raiden.c",
		MAME_DIR .. "src/mame/video/raiden.c",
		MAME_DIR .. "src/mame/drivers/raiden2.c",
		MAME_DIR .. "src/mame/machine/r2crypt.c",
		MAME_DIR .. "src/mame/machine/raiden2cop.c",
		MAME_DIR .. "src/mame/machine/seibuspi.c",
		MAME_DIR .. "src/mame/drivers/r2dx_v33.c",
		MAME_DIR .. "src/mame/audio/seibu.c",
		MAME_DIR .. "src/mame/video/seibu_crtc.c",

		MAME_DIR .. "src/mame/drivers/snowbros.c",
		MAME_DIR .. "src/mame/video/kan_pand.c",
		MAME_DIR .. "src/mame/video/kan_panb.c",
		MAME_DIR .. "src/mame/drivers/shadfrce.c",
		MAME_DIR .. "src/mame/video/shadfrce.c",
		MAME_DIR .. "src/mame/drivers/btoads.c",
		MAME_DIR .. "src/mame/video/btoads.c",
	}
end

_G["linkProjects_mame_misc-16"] = function(_target, _subtarget)
	links {
		"mame_misc_16",
	}
end
