// license:BSD-3-Clause
// copyright-holders:Arcade Runtime contributors

#include "emu.h"
#include "web_bridge.h"

#include "diimage.h"
#include "dinvram.h"
#include "romload.h"
#include "osdepend.h"

#include <emscripten.h>
#include <sstream>
#include <string>

#if defined(EMSCRIPTEN)

extern void web_input_set_control(int pad, int item, int pressed);
extern int web_video_width();
extern int web_video_height();
extern "C" int web_flush_nvram();

static running_machine *s_machine;
static bool s_machine_started;
static bool s_stopped;
static bool s_exit_reported;
static bool s_frontend_reported;
static bool s_state_pending;
static std::string s_machine_info;

EM_JS(void, web_js_tick, (), {
	var web = Module['web'];
	if (web && typeof web['onTick'] === 'function') web['onTick']();
});

EM_JS(void, web_js_frame, (const UINT8 *pixels, int width, int height), {
	var web = Module['web'];
	if (web && typeof web['onFrame'] === 'function') web['onFrame'](pixels, width, height);
});

EM_JS(void, web_js_sound, (const float *samples, int frames), {
	var web = Module['web'];
	if (web && typeof web['onSound'] === 'function') web['onSound'](samples, frames);
});

EM_JS(void, web_js_state_done, (int success), {
	var web = Module['web'];
	if (web && typeof web['onStateDone'] === 'function') web['onStateDone'](success);
});

EM_JS(void, web_js_exit, (), {
	var web = Module['web'];
	if (web && typeof web['onExit'] === 'function') web['onExit']();
});

EM_JS(void, web_js_frontend_done, (int result), {
	var web = Module['web'];
	if (web && typeof web['onFrontendDone'] === 'function') web['onFrontendDone'](result);
});

EM_JS(void, web_js_log, (int level, const char *text), {
	var web = Module['web'];
	if (web && typeof web['onLog'] === 'function') web['onLog'](level, text);
});

EM_JS(void, web_js_prepare_state_file, (const char *path), {
	var name = UTF8ToString(path);
	FS.mkdirTree('/mame/sta');
	if (!FS.analyzePath(name).exists) FS.writeFile(name, new Uint8Array(0));
});

static std::string json_string(const char *source)
{
	std::ostringstream result;
	result << '"';
	for (const unsigned char *cursor = reinterpret_cast<const unsigned char *>(source == NULL ? "" : source); *cursor != 0; cursor++)
	{
		switch (*cursor)
		{
			case '"': result << "\\\""; break;
			case '\\': result << "\\\\"; break;
			case '\b': result << "\\b"; break;
			case '\f': result << "\\f"; break;
			case '\n': result << "\\n"; break;
			case '\r': result << "\\r"; break;
			case '\t': result << "\\t"; break;
			default:
				if (*cursor < 0x20)
				{
					static const char digits[] = "0123456789abcdef";
					result << "\\u00" << digits[*cursor >> 4] << digits[*cursor & 0x0f];
				}
				else
					result << char(*cursor);
				break;
		}
	}
	result << '"';
	return result.str();
}

static bool valid_state_name(const char *name)
{
	if (name == NULL || name[0] == 0 || strstr(name, "..") != NULL)
		return false;
	for (const unsigned char *cursor = reinterpret_cast<const unsigned char *>(name); *cursor != 0; cursor++)
		if (!(isalnum(*cursor) || *cursor == '-' || *cursor == '_'))
			return false;
	return true;
}

static void schedule_state(const char *name, bool save)
{
	if (s_machine == NULL || s_stopped || s_state_pending || !valid_state_name(name))
	{
		web_js_state_done(0);
		return;
	}

	std::string path("/mame/sta/");
	path.append(name).append(".sta");
	if (save)
		web_js_prepare_state_file(path.c_str());
	s_state_pending = true;
	if (save)
		s_machine->schedule_save(path.c_str());
	else
		s_machine->schedule_load(path.c_str());
}

void web_bridge_start(running_machine *machine)
{
	if (s_machine_started)
		throw emu_fatalerror(MAMERR_FATALERROR, "A web module cannot start a second machine");

	s_machine = machine;
	s_machine_started = true;
	s_stopped = false;
	machine->video().set_throttled(false);
	machine->video().set_frameskip(0);

	EM_ASM({ throw 'SimulateInfiniteLoop'; });
}

void web_bridge_frame(const UINT8 *pixels, int width, int height)
{
	if (!s_stopped)
		web_js_frame(pixels, width, height);
}

void web_bridge_sound(const float *samples, int frames)
{
	if (!s_stopped)
		web_js_sound(samples, frames);
}

void web_bridge_state_done(bool success)
{
	if (!s_state_pending)
		return;
	s_state_pending = false;
	web_js_state_done(success ? 1 : 0);
}

void web_bridge_frontend_done(int result)
{
	if (s_machine_started || s_frontend_reported)
		return;
	s_frontend_reported = true;
	web_js_frontend_done(result);
}

void web_bridge_log(osd_output_channel channel, const char *text)
{
	int level = channel == OSD_OUTPUT_CHANNEL_ERROR ? 0
		: channel == OSD_OUTPUT_CHANNEL_WARNING ? 1
		: channel == OSD_OUTPUT_CHANNEL_INFO ? 2 : 3;
	const char *start = text;
	for (const char *cursor = text; ; cursor++)
	{
		if (*cursor == '\n' || *cursor == 0)
		{
			if (cursor != start)
			{
				std::string line(start, cursor - start);
				web_js_log(level, line.c_str());
			}
			if (*cursor == 0)
				break;
			start = cursor + 1;
		}
	}
}

extern "C" EMSCRIPTEN_KEEPALIVE int web_run_frames(int count)
{
	if (s_machine == NULL || s_stopped || s_machine->paused() || count <= 0)
		return 0;

	if (s_machine->save_or_load_pending())
		s_machine->web_service_saveload();

	screen_device *screen = s_machine->first_screen();
	if (screen == NULL)
		return 0;

	int advanced = 0;
	while (advanced < count && !s_machine->exit_pending())
	{
		UINT64 frame = screen->frame_number();
		do
		{
			s_machine->scheduler().timeslice();
		} while (screen->frame_number() == frame && !s_machine->exit_pending());

		if (screen->frame_number() != frame)
		{
			advanced++;
			web_js_tick();
		}
	}
	return advanced;
}

extern "C" EMSCRIPTEN_KEEPALIVE void web_pump()
{
	if (s_machine != NULL && !s_stopped)
		s_machine->osd().update(false);
}

extern "C" EMSCRIPTEN_KEEPALIVE void web_set_control(int pad, int item, int pressed)
{
	web_input_set_control(pad, item, pressed);
}

extern "C" EMSCRIPTEN_KEEPALIVE void web_pause()
{
	if (s_machine != NULL && !s_stopped)
		s_machine->pause();
}

extern "C" EMSCRIPTEN_KEEPALIVE void web_resume()
{
	if (s_machine != NULL && !s_stopped)
		s_machine->resume();
}

extern "C" EMSCRIPTEN_KEEPALIVE void web_reset(int hard)
{
	if (s_machine != NULL && !s_stopped)
		s_machine->schedule_soft_reset();
}

extern "C" EMSCRIPTEN_KEEPALIVE void web_save_state(const char *name)
{
	schedule_state(name, true);
}

extern "C" EMSCRIPTEN_KEEPALIVE void web_load_state(const char *name)
{
	schedule_state(name, false);
}

extern "C" EMSCRIPTEN_KEEPALIVE void web_exit()
{
	if (s_machine == NULL || s_stopped)
		return;
	s_stopped = true;
	s_machine->schedule_exit();
	web_flush_nvram();
	if (!s_exit_reported)
	{
		s_exit_reported = true;
		web_js_exit();
	}
}

extern "C" EMSCRIPTEN_KEEPALIVE int web_flush_nvram()
{
	return s_machine == NULL ? 1 : s_machine->web_flush_nvram();
}

extern "C" EMSCRIPTEN_KEEPALIVE const char *web_machine_info()
{
	if (s_machine == NULL)
	{
		s_machine_info = "{}";
		return s_machine_info.c_str();
	}

	int players = 0;
	int buttons = 0;
	for (ioport_port *port = s_machine->ioport().first_port(); port != NULL; port = port->next())
		for (ioport_field *field = port->first_field(); field != NULL; field = field->next())
		{
			players = MAX(players, field->player() + 1);
			if (field->type() >= IPT_BUTTON1 && field->type() <= IPT_BUTTON6)
				buttons = MAX(buttons, int(field->type() - IPT_BUTTON1 + 1));
		}
	players = MIN(4, MAX(1, players));

	bool has_nvram = nvram_interface_iterator(s_machine->root_device()).count() != 0;
	if (!has_nvram)
	{
		image_interface_iterator images(s_machine->root_device());
		for (device_image_interface *image = images.first(); image != NULL; image = images.next())
			if (image->image_type() == IO_MEMCARD)
			{
				has_nvram = true;
				break;
			}
	}

	screen_device *screen = s_machine->first_screen();
	double refresh = screen == NULL ? 60.0 : ATTOSECONDS_TO_HZ(screen->frame_period().attoseconds);
	bool vertical = (s_machine->system().flags & ORIENTATION_SWAP_XY) != 0;

	std::ostringstream json;
	json.precision(12);
	json << "{\"name\":" << json_string(s_machine->system().name)
		<< ",\"description\":" << json_string(s_machine->system().description)
		<< ",\"width\":" << web_video_width()
		<< ",\"height\":" << web_video_height()
		<< ",\"refreshHz\":" << refresh
		<< ",\"orientation\":\"" << (vertical ? "vertical" : "horizontal") << "\""
		<< ",\"aspectRatio\":" << (vertical ? 0.75 : (4.0 / 3.0))
		<< ",\"players\":" << players
		<< ",\"buttons\":" << buttons
		<< ",\"bios\":[";

	bool first_bios = true;
	const rom_entry *rom = s_machine->root_device().rom_region();
	if (rom != NULL)
		for ( ; !ROMENTRY_ISEND(rom); rom++)
			if (ROMENTRY_ISSYSTEM_BIOS(rom))
			{
				if (!first_bios)
					json << ',';
				first_bios = false;
				json << "{\"name\":" << json_string(ROM_GETNAME(rom))
					<< ",\"description\":" << json_string(ROM_GETHASHDATA(rom))
					<< ",\"isDefault\":"
					<< (ROM_GETBIOSFLAGS(rom) == s_machine->root_device().default_bios() ? "true" : "false")
					<< '}';
			}

	json << "],\"hasNvram\":" << (has_nvram ? "true" : "false") << '}';
	s_machine_info = json.str();
	return s_machine_info.c_str();
}

#endif
