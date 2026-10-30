---------------------------------------------------------------------------
--
--   konami-16.lua
--
--   MAME 0.161 Konami 16-bit family target.
--
---------------------------------------------------------------------------

CPUS["Z80"] = true
-- MAME 0.161's M6809 core selection supplies M6809, HD6309 and KONAMI.
CPUS["M6809"] = true
CPUS["M680X0"] = true
CPUS["TMS57002"] = true

SOUNDS["SAMPLES"] = true
SOUNDS["YM2151"] = true
SOUNDS["YM3812"] = true
SOUNDS["OKIM6295"] = true
SOUNDS["UPD7759"] = true
SOUNDS["K007232"] = true
SOUNDS["K053260"] = true
SOUNDS["K054539"] = true
SOUNDS["K056800"] = true

MACHINES["BANKDEV"] = true
MACHINES["EEPROMDEV"] = true
MACHINES["K053252"] = true

-- The release-era generated project always archives the bus library, and its
-- pinned llvm-ar cannot create an empty archive. Keep one harmless bus core.
BUSES["CENTRONICS"] = true

_G["createProjects_mame_konami-16"] = function(_target, _subtarget)
	project ("mame_konami_16")
	targetsubdir(_target .. "_" .. _subtarget)
	kind "StaticLib"
	uuid (os.uuid("drv-mame-konami-16"))

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
		MAME_DIR .. "src/mame/drivers/tmnt.c",
		MAME_DIR .. "src/mame/video/tmnt.c",
		MAME_DIR .. "src/mame/drivers/simpsons.c",
		MAME_DIR .. "src/mame/machine/simpsons.c",
		MAME_DIR .. "src/mame/video/simpsons.c",
		MAME_DIR .. "src/mame/drivers/xmen.c",
		MAME_DIR .. "src/mame/video/xmen.c",
		MAME_DIR .. "src/mame/drivers/gijoe.c",
		MAME_DIR .. "src/mame/video/gijoe.c",
		MAME_DIR .. "src/mame/drivers/gradius3.c",
		MAME_DIR .. "src/mame/video/gradius3.c",
		MAME_DIR .. "src/mame/drivers/mystwarr.c",
		MAME_DIR .. "src/mame/video/mystwarr.c",
		MAME_DIR .. "src/mame/drivers/spy.c",
		MAME_DIR .. "src/mame/video/spy.c",

		MAME_DIR .. "src/mame/video/konami_helper.c",
		MAME_DIR .. "src/mame/video/k051316.c",
		MAME_DIR .. "src/mame/video/k051960.c",
		MAME_DIR .. "src/mame/video/k052109.c",
		MAME_DIR .. "src/mame/video/k053250.c",
		MAME_DIR .. "src/mame/video/k053251.c",
		MAME_DIR .. "src/mame/video/k053244_k053245.c",
		MAME_DIR .. "src/mame/video/k053246_k053247_k055673.c",
		MAME_DIR .. "src/mame/video/k053936.c",
		MAME_DIR .. "src/mame/video/k054000.c",
		MAME_DIR .. "src/mame/video/k054156_k054157_k056832.c",
		MAME_DIR .. "src/mame/video/k054338.c",
		MAME_DIR .. "src/mame/video/k055555.c",

		-- `mystwarr.c`-class drivers reuse the Konami GX mixer helpers.
		MAME_DIR .. "src/mame/machine/konamigx.c",
		MAME_DIR .. "src/mame/video/konamigx.c",
	}
end

_G["linkProjects_mame_konami-16"] = function(_target, _subtarget)
	links {
		"mame_konami_16",
	}
end
