---------------------------------------------------------------------------
--
--   namco-s1.lua
--
--   MAME 0.161 Namco System 1 family target.
--
---------------------------------------------------------------------------

CPUS["M6800"] = true
CPUS["M6809"] = true

SOUNDS["DAC"] = true
SOUNDS["YM2151"] = true
SOUNDS["NAMCO_CUS30"] = true
SOUNDS["NAMCO_63701X"] = true

-- The release-era generated project always archives the bus library, and its
-- pinned llvm-ar cannot create an empty archive. Keep one harmless bus core.
BUSES["CENTRONICS"] = true

_G["createProjects_mame_namco-s1"] = function(_target, _subtarget)
	project ("mame_namco_s1")
	targetsubdir(_target .. "_" .. _subtarget)
	kind "StaticLib"
	uuid (os.uuid("drv-mame-namco-s1"))

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
		MAME_DIR .. "src/mame/drivers/namcos1.c",
		MAME_DIR .. "src/mame/machine/namcos1.c",
		MAME_DIR .. "src/mame/video/namcos1.c",
		MAME_DIR .. "src/mame/drivers/namcos86.c",
		MAME_DIR .. "src/mame/video/namcos86.c",
		MAME_DIR .. "src/mame/machine/c117.c",
		MAME_DIR .. "src/mame/video/c116.c",
	}
end

_G["linkProjects_mame_namco-s1"] = function(_target, _subtarget)
	links {
		"mame_namco_s1",
	}
end
