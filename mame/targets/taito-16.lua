---------------------------------------------------------------------------
--
--   taito-16.lua
--
--   MAME 0.161 Taito 16-bit family target.
--
---------------------------------------------------------------------------

CPUS["Z80"] = true
CPUS["Z180"] = true
CPUS["M680X0"] = true

SOUNDS["YM2151"] = true
SOUNDS["YM2203"] = true
SOUNDS["YM2610"] = true
SOUNDS["YM2610B"] = true
SOUNDS["MSM5205"] = true
SOUNDS["OKIM6295"] = true
SOUNDS["X1_010"] = true

VIDEOS["HD63484"] = true

MACHINES["EEPROMDEV"] = true
MACHINES["MB87078"] = true

-- The release-era generated project always archives the bus library, and its
-- pinned llvm-ar cannot create an empty archive. Keep one harmless bus core.
BUSES["CENTRONICS"] = true

_G["createProjects_mame_taito-16"] = function(_target, _subtarget)
	project ("mame_taito_16")
	targetsubdir(_target .. "_" .. _subtarget)
	kind "StaticLib"
	uuid (os.uuid("drv-mame-taito-16"))

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
		MAME_DIR .. "src/mame/drivers/rastan.c",
		MAME_DIR .. "src/mame/video/rastan.c",
		MAME_DIR .. "src/mame/drivers/opwolf.c",
		MAME_DIR .. "src/mame/machine/opwolf.c",
		MAME_DIR .. "src/mame/video/opwolf.c",
		MAME_DIR .. "src/mame/drivers/rainbow.c",
		MAME_DIR .. "src/mame/machine/rainbow.c",
		MAME_DIR .. "src/mame/video/rainbow.c",
		MAME_DIR .. "src/mame/drivers/volfied.c",
		MAME_DIR .. "src/mame/machine/volfied.c",
		MAME_DIR .. "src/mame/video/volfied.c",
		MAME_DIR .. "src/mame/drivers/asuka.c",
		MAME_DIR .. "src/mame/machine/bonzeadv.c",
		MAME_DIR .. "src/mame/video/asuka.c",
		MAME_DIR .. "src/mame/drivers/taito_l.c",
		MAME_DIR .. "src/mame/video/taito_l.c",
		MAME_DIR .. "src/mame/drivers/taito_x.c",
		MAME_DIR .. "src/mame/drivers/taito_b.c",
		MAME_DIR .. "src/mame/video/taito_b.c",
		MAME_DIR .. "src/mame/drivers/taito_f2.c",
		MAME_DIR .. "src/mame/video/taito_f2.c",
		MAME_DIR .. "src/mame/drivers/taito_h.c",
		MAME_DIR .. "src/mame/video/taito_h.c",

		MAME_DIR .. "src/mame/machine/cchip.c",
		MAME_DIR .. "src/mame/audio/taitosnd.c",
		MAME_DIR .. "src/mame/audio/taito_zm.c",
		MAME_DIR .. "src/mame/audio/t5182.c",
		MAME_DIR .. "src/mame/machine/taitoio.c",
		MAME_DIR .. "src/mame/video/taito_helper.c",
		MAME_DIR .. "src/mame/video/pc080sn.c",
		MAME_DIR .. "src/mame/video/pc090oj.c",
		MAME_DIR .. "src/mame/video/tc0080vco.c",
		MAME_DIR .. "src/mame/video/tc0100scn.c",
		MAME_DIR .. "src/mame/video/tc0150rod.c",
		MAME_DIR .. "src/mame/video/tc0280grd.c",
		MAME_DIR .. "src/mame/video/tc0360pri.c",
		MAME_DIR .. "src/mame/video/tc0480scp.c",
		MAME_DIR .. "src/mame/video/tc0110pcr.c",
		MAME_DIR .. "src/mame/video/tc0180vcu.c",

		-- Taito X inherits SETA's no-layer renderer and uses its sprite device.
		MAME_DIR .. "src/mame/video/seta.c",
		MAME_DIR .. "src/mame/video/seta001.c",
	}
end

_G["linkProjects_mame_taito-16"] = function(_target, _subtarget)
	links {
		"mame_taito_16",
	}
end
