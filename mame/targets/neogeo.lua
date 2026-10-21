---------------------------------------------------------------------------
--
--   neogeo.lua
--
--   MAME 0.161 Neo Geo family target.
--
---------------------------------------------------------------------------

CPUS["Z80"] = true
CPUS["M680X0"] = true

SOUNDS["YM2610"] = true

MACHINES["UPD1990A"] = true

BUSES["NEOGEO"] = true

function createProjects_mame_neogeo(_target, _subtarget)
	project ("mame_neogeo")
	targetsubdir(_target .. "_" .. _subtarget)
	kind "StaticLib"
	uuid (os.uuid("drv-mame-neogeo"))

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
		MAME_DIR .. "src/mame/drivers/neogeo.c",
		MAME_DIR .. "src/mame/video/neogeo.c",
		MAME_DIR .. "src/mame/drivers/neogeo_noslot.c",
		MAME_DIR .. "src/mame/video/neogeo_spr.c",
		MAME_DIR .. "src/mame/machine/neoboot.c",
		MAME_DIR .. "src/mame/machine/neocrypt.c",
		MAME_DIR .. "src/mame/machine/neoprot.c",
		MAME_DIR .. "src/mame/machine/ng_memcard.c",
	}
end

function linkProjects_mame_neogeo(_target, _subtarget)
	links {
		"mame_neogeo",
	}
end
