// license:BSD-3-Clause
// copyright-holders:Arcade Runtime contributors

#ifndef MAME_OSD_MODULES_WEB_WEB_BRIDGE_H
#define MAME_OSD_MODULES_WEB_WEB_BRIDGE_H

#include "osdcore.h"

class running_machine;

#if defined(EMSCRIPTEN)
void web_bridge_start(running_machine *machine);
void web_bridge_frame(const UINT8 *pixels, int width, int height);
void web_bridge_sound(const float *samples, int frames);
void web_bridge_state_done(bool success);
void web_bridge_frontend_done(int result);
void web_bridge_log(osd_output_channel channel, const char *text);
#endif

#endif
