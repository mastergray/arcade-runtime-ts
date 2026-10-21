---------------------------------------------------------------------------
--
--   cps2.lua
--
--   MAME 0.161 CPS-2 family target.
--
---------------------------------------------------------------------------

CPUS["Z80"] = true
CPUS["M680X0"] = true
CPUS["PIC16C5X"] = true

SOUNDS["YM2151"] = true
SOUNDS["MSM5205"] = true
SOUNDS["QSOUND"] = true
SOUNDS["OKIM6295"] = true

MACHINES["EEPROMDEV"] = true
MACHINES["TIMEKPR"] = true

-- The release-era generated project always archives the bus library, and its
-- pinned llvm-ar cannot create an empty archive. Keep one harmless bus core.
BUSES["CENTRONICS"] = true

function createProjects_mame_cps2(_target, _subtarget)
	project ("mame_cps2")
	targetsubdir(_target .. "_" .. _subtarget)
	kind "StaticLib"
	uuid (os.uuid("drv-mame-cps2"))

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
		MAME_DIR .. "src/mame/drivers/cps2.c",
		MAME_DIR .. "src/mame/machine/cps2crpt.c",
		-- cps2.c reuses QSound handlers and its address map from cps1.c. Since
		-- 0.161 builds at compilation-unit granularity, include that unit and
		-- its Kabuki helper along with the shared CPS video implementation.
		MAME_DIR .. "src/mame/drivers/cps1.c",
		MAME_DIR .. "src/mame/video/cps1.c",
		MAME_DIR .. "src/mame/machine/kabuki.c",
	}
end

function linkProjects_mame_cps2(_target, _subtarget)
	links {
		"mame_cps2",
	}
end
