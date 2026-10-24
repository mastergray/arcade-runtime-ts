---------------------------------------------------------------------------
--
--   namco-nb.lua
--
--   MAME 0.161 Namco NB-1/NB-2 family target.
--
---------------------------------------------------------------------------

CPUS["M6502"] = true
CPUS["M680X0"] = true
CPUS["M37710"] = true

SOUNDS["C352"] = true

MACHINES["EEPROMDEV"] = true

-- The release-era generated project always archives the bus library, and its
-- pinned llvm-ar cannot create an empty archive. Keep one harmless bus core.
BUSES["CENTRONICS"] = true

_G["createProjects_mame_namco-nb"] = function(_target, _subtarget)
	project ("mame_namco_nb")
	targetsubdir(_target .. "_" .. _subtarget)
	kind "StaticLib"
	uuid (os.uuid("drv-mame-namco-nb"))

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
		MAME_DIR .. "src/mame/drivers/namconb1.c",
		MAME_DIR .. "src/mame/video/namconb1.c",
		MAME_DIR .. "src/mame/drivers/namcoic.c",
		MAME_DIR .. "src/mame/machine/namcomcu.c",
		MAME_DIR .. "src/mame/video/c116.c",
	}
end

_G["linkProjects_mame_namco-nb"] = function(_target, _subtarget)
	links {
		"mame_namco_nb",
	}
end
