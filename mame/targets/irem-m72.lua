---------------------------------------------------------------------------
--
--   irem-m72.lua
--
--   MAME 0.161 Irem M72 family-size probe target.
--
---------------------------------------------------------------------------

CPUS["Z80"] = true
CPUS["NEC"] = true
CPUS["V30MZ"] = true
CPUS["MCS51"] = true

SOUNDS["DAC"] = true
SOUNDS["YM2151"] = true

-- The release-era generated project always archives the bus library, and its
-- pinned llvm-ar cannot create an empty archive. Keep one harmless bus core.
BUSES["CENTRONICS"] = true

function createProjects_mame_runtimeprobe(_target, _subtarget)
	project ("mame_runtimeprobe")
	targetsubdir(_target .. "_" .. _subtarget)
	kind "StaticLib"
	uuid (os.uuid("drv-mame-runtimeprobe"))

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
		MAME_DIR .. "src/mame/drivers/m72.c",
		MAME_DIR .. "src/mame/audio/m72.c",
		MAME_DIR .. "src/mame/video/m72.c",
		MAME_DIR .. "src/mame/machine/irem_cpu.c",
	}
end

function linkProjects_mame_runtimeprobe(_target, _subtarget)
	links {
		"mame_runtimeprobe",
	}
end
