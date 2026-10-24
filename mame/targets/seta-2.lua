---------------------------------------------------------------------------
--
--   seta-2.lua
--
--   MAME 0.161 Seta 2 family target.
--
---------------------------------------------------------------------------

CPUS["M680X0"] = true
CPUS["H8"] = true

SOUNDS["X1_010"] = true
SOUNDS["OKIM9810"] = true

MACHINES["TMP68301"] = true
MACHINES["MCF5206E"] = true
MACHINES["EEPROMDEV"] = true

-- The release-era generated project always archives the bus library, and its
-- pinned llvm-ar cannot create an empty archive. Keep one harmless bus core.
BUSES["CENTRONICS"] = true

_G["createProjects_mame_seta-2"] = function(_target, _subtarget)
	project ("mame_seta_2")
	targetsubdir(_target .. "_" .. _subtarget)
	kind "StaticLib"
	uuid (os.uuid("drv-mame-seta-2"))

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
		MAME_DIR .. "src/mame/drivers/seta2.c",
		MAME_DIR .. "src/mame/video/seta2.c",
		MAME_DIR .. "src/mame/machine/ticket.c",
	}
end

_G["linkProjects_mame_seta-2"] = function(_target, _subtarget)
	links {
		"mame_seta_2",
	}
end
