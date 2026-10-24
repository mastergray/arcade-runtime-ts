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
#include <utility>
#include <vector>

#if defined(EMSCRIPTEN)

extern void web_input_set_control(int pad, int item, int pressed);
extern void web_input_set_axis(int pad, int axis, float value);
extern void web_input_exit();
extern int web_video_width();
extern int web_video_height();
extern void web_video_render();
extern "C" int web_flush_nvram();

static running_machine *s_machine;
static bool s_machine_started;
static bool s_stopped;
static bool s_exit_reported;
static bool s_frontend_reported;
static bool s_state_pending;
static bool s_state_loading;
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

static const char *web_analog_kind(ioport_type type)
{
	switch (type)
	{
		case IPT_AD_STICK_X: return "stick-x";
		case IPT_AD_STICK_Y: return "stick-y";
		case IPT_AD_STICK_Z: return "stick-z";
		case IPT_PADDLE: return "paddle";
		case IPT_PADDLE_V: return "paddle-v";
		case IPT_PEDAL: return "pedal-1";
		case IPT_PEDAL2: return "pedal-2";
		case IPT_PEDAL3: return "pedal-3";
		case IPT_DIAL: return "dial";
		case IPT_DIAL_V: return "dial-v";
		case IPT_TRACKBALL_X: return "trackball-x";
		case IPT_TRACKBALL_Y: return "trackball-y";
		case IPT_LIGHTGUN_X: return "lightgun-x";
		case IPT_LIGHTGUN_Y: return "lightgun-y";
		case IPT_MOUSE_X: return "mouse-x";
		case IPT_MOUSE_Y: return "mouse-y";
		case IPT_POSITIONAL: return "positional";
		case IPT_POSITIONAL_V: return "positional-v";
		default: return NULL;
	}
}

static bool web_dual_stick_type(ioport_type type)
{
	switch (type)
	{
		case IPT_JOYSTICKLEFT_UP:
		case IPT_JOYSTICKLEFT_DOWN:
		case IPT_JOYSTICKLEFT_LEFT:
		case IPT_JOYSTICKLEFT_RIGHT:
		case IPT_JOYSTICKRIGHT_UP:
		case IPT_JOYSTICKRIGHT_DOWN:
		case IPT_JOYSTICKRIGHT_LEFT:
		case IPT_JOYSTICKRIGHT_RIGHT:
			return true;
		default:
			return false;
	}
}

static bool web_rebindable_coded_field(const ioport_field &field)
{
	ioport_type type = field.type();
	return !field.defseq_unresolved(SEQ_TYPE_STANDARD).is_default()
		&& type != IPT_UNUSED
		&& type != IPT_UNKNOWN
		&& type != IPT_SPECIAL
		&& type != IPT_CUSTOM
		&& type != IPT_DIPSWITCH
		&& type != IPT_CONFIG;
}

static bool web_sequence_contains(const input_seq &sequence, const input_code &code)
{
	for (int index = 0; index < sequence.length(); index++)
		if (sequence[index] == code)
			return true;
	return false;
}

static bool web_append_or(input_seq &sequence, const input_code &code)
{
	if (web_sequence_contains(sequence, code))
		return false;
	// input_seq holds 16 codes including its end marker. An OR append needs two free slots.
	if (sequence.length() != 0 && sequence.length() > 13)
		return false;
	sequence |= code;
	return web_sequence_contains(sequence, code);
}

static bool web_operator_key(const input_code &code, const char *&name, input_code &pad_code)
{
	if (code == KEYCODE_F1) { name = "F1"; pad_code = JOYCODE_BUTTON18; return true; }
	if (code == KEYCODE_F2) { name = "F2"; pad_code = JOYCODE_BUTTON19; return true; }
	if (code == KEYCODE_F5) { name = "F5"; pad_code = JOYCODE_BUTTON20; return true; }
	if (code == KEYCODE_F6) { name = "F6"; pad_code = JOYCODE_BUTTON21; return true; }
	if (code == KEYCODE_0) { name = "0"; pad_code = JOYCODE_BUTTON22; return true; }
	if (code == KEYCODE_1) { name = "1"; pad_code = JOYCODE_BUTTON23; return true; }
	if (code == KEYCODE_2) { name = "2"; pad_code = JOYCODE_BUTTON24; return true; }
	if (code == KEYCODE_3) { name = "3"; pad_code = JOYCODE_BUTTON25; return true; }
	if (code == KEYCODE_4) { name = "4"; pad_code = JOYCODE_BUTTON26; return true; }
	if (code == KEYCODE_5) { name = "5"; pad_code = JOYCODE_BUTTON27; return true; }
	if (code == KEYCODE_6) { name = "6"; pad_code = JOYCODE_BUTTON28; return true; }
	if (code == KEYCODE_7) { name = "7"; pad_code = JOYCODE_BUTTON29; return true; }
	if (code == KEYCODE_8) { name = "8"; pad_code = JOYCODE_BUTTON30; return true; }
	if (code == KEYCODE_9) { name = "9"; pad_code = JOYCODE_BUTTON31; return true; }
	return false;
}

static int web_coded_field_count(running_machine &machine, ioport_type type, int player)
{
	int count = 0;
	for (ioport_port *port = machine.ioport().first_port(); port != NULL; port = port->next())
		for (ioport_field *field = port->first_field(); field != NULL; field = field->next())
			if (web_rebindable_coded_field(*field) && field->type() == type && field->player() == player)
				count++;
	return count;
}

static void web_rebind_coded_fields(running_machine &machine)
{
	for (ioport_port *port = machine.ioport().first_port(); port != NULL; port = port->next())
		for (ioport_field *field = port->first_field(); field != NULL; field = field->next())
		{
			if (!web_rebindable_coded_field(*field))
				continue;

			ioport_field::user_settings settings;
			field->get_user_settings(settings);
			bool changed = false;
			if (web_coded_field_count(machine, field->type(), field->player()) == 1)
			{
				const input_seq &type_sequence = machine.ioport().type_seq(field->type(), field->player(), SEQ_TYPE_STANDARD);
				for (int index = 0; index < type_sequence.length(); index++)
					if (!type_sequence[index].internal())
						changed = web_append_or(settings.seq[SEQ_TYPE_STANDARD], type_sequence[index]) || changed;
			}

			const input_seq &declared = field->defseq_unresolved(SEQ_TYPE_STANDARD);
			for (int index = 0; index < declared.length(); index++)
			{
				const char *key_name = NULL;
				input_code pad_code;
				if (web_operator_key(declared[index], key_name, pad_code))
					changed = web_append_or(settings.seq[SEQ_TYPE_STANDARD], pad_code) || changed;
			}

			if (changed)
			{
				field->set_user_settings(settings);
				osd_printf_info("Web input rebound field: %s\n", field->name());
			}
		}
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
	s_state_loading = !save;
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
	web_rebind_coded_fields(*machine);
}

bool web_bridge_machine_started()
{
	return s_machine_started;
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
	s_state_loading = false;
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

	bool loaded_state = s_state_pending && s_state_loading;
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
			if (!loaded_state)
				web_video_render();
			loaded_state = false;
			advanced++;
			web_js_tick();
		}
	}
	return advanced;
}

extern "C" EMSCRIPTEN_KEEPALIVE void web_pump()
{
	if (s_machine != NULL && !s_stopped)
	{
		s_machine->osd().update(false);
		web_video_render();
	}
}

extern "C" EMSCRIPTEN_KEEPALIVE void web_set_control(int pad, int item, int pressed)
{
	web_input_set_control(pad, item, pressed);
}

extern "C" EMSCRIPTEN_KEEPALIVE void web_set_axis(int pad, int axis, float value)
{
	web_input_set_axis(pad, axis, value);
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
	web_input_exit();
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
	if (s_machine == NULL || s_machine->web_flush_nvram() != 0)
		return 1;

	image_interface_iterator images(s_machine->root_device());
	for (device_image_interface *image = images.first(); image != NULL; image = images.next())
	{
		if (image->image_type() != IO_MEMCARD || !image->exists())
			continue;

		if (image->is_readonly())
			return 1;
		image->call_unload();
		if (image->ftell() != image->length())
			return 1;
	}
	return 0;
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
	bool dual_stick = false;
	bool volume = false;
	std::vector<std::pair<int, const char *> > analog_inputs;
	struct key_input
	{
		std::string name;
		std::string key;
		int player;
	};
	std::vector<key_input> key_inputs;
	for (ioport_port *port = s_machine->ioport().first_port(); port != NULL; port = port->next())
		for (ioport_field *field = port->first_field(); field != NULL; field = field->next())
		{
			players = MAX(players, field->player() + 1);
			if (field->type() >= IPT_BUTTON1 && field->type() <= IPT_BUTTON6)
				buttons = MAX(buttons, int(field->type() - IPT_BUTTON1 + 1));
			dual_stick = dual_stick || web_dual_stick_type(field->type());
			volume = volume || field->type() == IPT_VOLUME_UP || field->type() == IPT_VOLUME_DOWN;
			const char *kind = web_analog_kind(field->type());
			int player = field->player() + 1;
			if (kind != NULL && player >= 1 && player <= 4)
			{
				bool duplicate = false;
				for (std::vector<std::pair<int, const char *> >::const_iterator item = analog_inputs.begin(); item != analog_inputs.end(); item++)
					if (item->first == player && strcmp(item->second, kind) == 0)
					{
						duplicate = true;
						break;
					}
				if (!duplicate)
					analog_inputs.push_back(std::make_pair(player, kind));
			}
			if (web_rebindable_coded_field(*field))
			{
				const input_seq &declared = field->defseq_unresolved(SEQ_TYPE_STANDARD);
				for (int index = 0; index < declared.length(); index++)
				{
					const char *key_name = NULL;
					input_code pad_code;
					if (!web_operator_key(declared[index], key_name, pad_code) || player < 1 || player > 4)
						continue;
					bool duplicate = false;
					for (std::vector<key_input>::const_iterator item = key_inputs.begin(); item != key_inputs.end(); item++)
						if (item->name == field->name() && item->key == key_name)
						{
							duplicate = true;
							break;
						}
					if (!duplicate)
					{
						key_input input = { field->name(), key_name, player };
						key_inputs.push_back(input);
					}
				}
			}
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
		<< ",\"inputs\":{\"analog\":[";

	for (size_t index = 0; index < analog_inputs.size(); index++)
	{
		if (index != 0)
			json << ',';
		json << "{\"player\":" << analog_inputs[index].first
			<< ",\"kind\":" << json_string(analog_inputs[index].second) << '}';
	}

	json << "],\"dualStick\":" << (dual_stick ? "true" : "false")
		<< ",\"keys\":[";

	for (size_t index = 0; index < key_inputs.size(); index++)
	{
		if (index != 0)
			json << ',';
		json << "{\"name\":" << json_string(key_inputs[index].name.c_str())
			<< ",\"key\":" << json_string(key_inputs[index].key.c_str())
			<< ",\"player\":" << key_inputs[index].player << '}';
	}

	json << "],\"volume\":" << (volume ? "true" : "false") << '}'
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

	json << "],\"hasNvram\":" << (has_nvram ? "true" : "false")
		<< ",\"supportsSave\":" << ((s_machine->system().flags & GAME_SUPPORTS_SAVE) != 0 ? "true" : "false") << '}';
	s_machine_info = json.str();
	return s_machine_info.c_str();
}

#endif
