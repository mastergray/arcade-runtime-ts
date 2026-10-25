---------------------------------------------------------------------------
--
--   taito-f3.lua
--
--   MAME 0.161 Taito F3 family target.
--
---------------------------------------------------------------------------

CPUS["M680X0"] = true
CPUS["ES5510"] = true

SOUNDS["ES5505"] = true
SOUNDS["OKIM6295"] = true

MACHINES["EEPROMDEV"] = true
MACHINES["68681"] = true
MACHINES["MB87078"] = true

-- The release-era generated project always archives the bus library, and its
-- pinned llvm-ar cannot create an empty archive. Keep one harmless bus core.
BUSES["CENTRONICS"] = true

_G["createProjects_mame_taito-f3"] = function(_target, _subtarget)
	project ("mame_taito_f3")
	targetsubdir(_target .. "_" .. _subtarget)
	kind "StaticLib"
	uuid (os.uuid("drv-mame-taito-f3"))

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
		MAME_DIR .. "src/mame/drivers/taito_f3.c",
		MAME_DIR .. "src/mame/video/taito_f3.c",
		MAME_DIR .. "src/mame/audio/taito_en.c",
		MAME_DIR .. "src/mame/drivers/superchs.c",
		MAME_DIR .. "src/mame/video/superchs.c",
		MAME_DIR .. "src/mame/video/taito_helper.c",
		MAME_DIR .. "src/mame/video/tc0480scp.c",
	}
end

_G["linkProjects_mame_taito-f3"] = function(_target, _subtarget)
	links {
		"mame_taito_f3",
	}
end
