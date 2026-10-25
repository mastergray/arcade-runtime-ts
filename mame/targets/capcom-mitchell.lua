---------------------------------------------------------------------------
--
--   capcom-mitchell.lua
--
--   MAME 0.161 Capcom/Mitchell family target.
--
---------------------------------------------------------------------------

CPUS["Z80"] = true

SOUNDS["YM2413"] = true
SOUNDS["YM3812"] = true
SOUNDS["MSM5205"] = true
SOUNDS["OKIM6295"] = true

MACHINES["EEPROMDEV"] = true

-- The release-era generated project always archives the bus library, and its
-- pinned llvm-ar cannot create an empty archive. Keep one harmless bus core.
BUSES["CENTRONICS"] = true

_G["createProjects_mame_capcom-mitchell"] = function(_target, _subtarget)
	project ("mame_capcom_mitchell")
	targetsubdir(_target .. "_" .. _subtarget)
	kind "StaticLib"
	uuid (os.uuid("drv-mame-capcom-mitchell"))

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
		MAME_DIR .. "src/mame/drivers/mitchell.c",
		MAME_DIR .. "src/mame/video/mitchell.c",
		MAME_DIR .. "src/mame/machine/kabuki.c",
	}
end

_G["linkProjects_mame_capcom-mitchell"] = function(_target, _subtarget)
	links {
		"mame_capcom_mitchell",
	}
end
