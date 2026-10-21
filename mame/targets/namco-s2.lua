---------------------------------------------------------------------------
--
--   namco-s2.lua
--
--   MAME 0.161 Namco System 2 family target.
--
---------------------------------------------------------------------------

CPUS["M6502"] = true
CPUS["M6805"] = true
CPUS["M6809"] = true
CPUS["M680X0"] = true

SOUNDS["YM2151"] = true
SOUNDS["C140"] = true

-- The release-era generated project always archives the bus library, and its
-- pinned llvm-ar cannot create an empty archive. Keep one harmless bus core.
BUSES["CENTRONICS"] = true

_G["createProjects_mame_namco-s2"] = function(_target, _subtarget)
	project ("mame_namco_s2")
	targetsubdir(_target .. "_" .. _subtarget)
	kind "StaticLib"
	uuid (os.uuid("drv-mame-namco-s2"))

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
		MAME_DIR .. "src/mame/drivers/namcos2.c",
		MAME_DIR .. "src/mame/machine/namcos2.c",
		MAME_DIR .. "src/mame/drivers/namcoic.c",
		MAME_DIR .. "src/mame/video/namcos2.c",
		MAME_DIR .. "src/mame/video/c45.c",
	}
end

_G["linkProjects_mame_namco-s2"] = function(_target, _subtarget)
	links {
		"mame_namco_s2",
	}
end
