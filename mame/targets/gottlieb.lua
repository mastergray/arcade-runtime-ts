---------------------------------------------------------------------------
--
--   gottlieb.lua
--
--   MAME 0.161 Gottlieb family target.
--
---------------------------------------------------------------------------

CPUS["I86"] = true
CPUS["M6502"] = true
CPUS["MCS48"] = true

SOUNDS["SAMPLES"] = true
SOUNDS["DAC"] = true
SOUNDS["AY8910"] = true
SOUNDS["SP0250"] = true
SOUNDS["VOTRAX"] = true

MACHINES["RIOT6532"] = true
MACHINES["MIOT6530"] = true
MACHINES["LDPR8210"] = true

-- The release-era generated project always archives the bus library, and its
-- pinned llvm-ar cannot create an empty archive. Keep one harmless bus core.
BUSES["CENTRONICS"] = true

function createProjects_mame_gottlieb(_target, _subtarget)
	project ("mame_gottlieb")
	targetsubdir(_target .. "_" .. _subtarget)
	kind "StaticLib"
	uuid (os.uuid("drv-mame-gottlieb"))

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
		MAME_DIR .. "src/mame/drivers/gottlieb.c",
		MAME_DIR .. "src/mame/audio/gottlieb.c",
		MAME_DIR .. "src/mame/video/gottlieb.c",
	}
end

function linkProjects_mame_gottlieb(_target, _subtarget)
	links {
		"mame_gottlieb",
	}
end
