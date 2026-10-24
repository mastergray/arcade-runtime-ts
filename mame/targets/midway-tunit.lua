---------------------------------------------------------------------------
--
--   midway-tunit.lua
--
--   MAME 0.161 Midway T-Unit/Y-Unit/Wolf Unit family target.
--
---------------------------------------------------------------------------

CPUS["Z80"] = true
CPUS["M6809"] = true
CPUS["TMS340X0"] = true
CPUS["ADSP21XX"] = true

SOUNDS["DAC"] = true
SOUNDS["DMADAC"] = true
SOUNDS["YM2151"] = true
SOUNDS["HC55516"] = true
SOUNDS["OKIM6295"] = true

MACHINES["6821PIA"] = true

-- The release-era generated project always archives the bus library, and its
-- pinned llvm-ar cannot create an empty archive. Keep one harmless bus core.
BUSES["CENTRONICS"] = true

_G["createProjects_mame_midway-tunit"] = function(_target, _subtarget)
	project ("mame_midway_tunit")
	targetsubdir(_target .. "_" .. _subtarget)
	kind "StaticLib"
	uuid (os.uuid("drv-mame-midway-tunit"))

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
		MAME_DIR .. "src/mame/drivers/midtunit.c",
		MAME_DIR .. "src/mame/machine/midtunit.c",
		MAME_DIR .. "src/mame/video/midtunit.c",
		MAME_DIR .. "src/mame/drivers/midyunit.c",
		MAME_DIR .. "src/mame/machine/midyunit.c",
		MAME_DIR .. "src/mame/video/midyunit.c",
		MAME_DIR .. "src/mame/drivers/midwunit.c",
		MAME_DIR .. "src/mame/machine/midwunit.c",
		MAME_DIR .. "src/mame/machine/midwayic.c",
		MAME_DIR .. "src/mame/audio/williams.c",
		MAME_DIR .. "src/mame/audio/dcs.c",
	}
end

_G["linkProjects_mame_midway-tunit"] = function(_target, _subtarget)
	links {
		"mame_midway_tunit",
	}
end
