// license:BSD-3-Clause
// copyright-holders:Arcade Runtime contributors

#include "emu.h"

#include <stdio.h>

#if defined(SDLMAME_EMSCRIPTEN)

enum
{
	WEB_CONTROL_UP = 0,
	WEB_CONTROL_DOWN,
	WEB_CONTROL_LEFT,
	WEB_CONTROL_RIGHT,
	WEB_CONTROL_BUTTON1,
	WEB_CONTROL_BUTTON2,
	WEB_CONTROL_BUTTON3,
	WEB_CONTROL_BUTTON4,
	WEB_CONTROL_BUTTON5,
	WEB_CONTROL_BUTTON6,
	WEB_CONTROL_COIN,
	WEB_CONTROL_START,
	WEB_CONTROL_SELECT,
	WEB_CONTROL_SERVICE,
	WEB_CONTROL_TEST,
	WEB_CONTROL_TILT,
	WEB_CONTROL_COUNT
};

static INT32 s_controls[4][WEB_CONTROL_COUNT];

static INT32 web_control_state(void *device_internal, void *item_internal)
{
	return *reinterpret_cast<INT32 *>(item_internal);
}

void web_input_init(running_machine &machine)
{
	static const char *const item_names[WEB_CONTROL_COUNT] =
	{
		"Up", "Down", "Left", "Right",
		"Button 1", "Button 2", "Button 3", "Button 4", "Button 5", "Button 6",
		"Coin", "Start", "Select", "Service", "Test", "Tilt"
	};
	static const input_item_id item_ids[WEB_CONTROL_COUNT] =
	{
		ITEM_ID_HAT1UP, ITEM_ID_HAT1DOWN, ITEM_ID_HAT1LEFT, ITEM_ID_HAT1RIGHT,
		ITEM_ID_BUTTON1, ITEM_ID_BUTTON2, ITEM_ID_BUTTON3, ITEM_ID_BUTTON4,
		ITEM_ID_BUTTON5, ITEM_ID_BUTTON6, ITEM_ID_BUTTON7, ITEM_ID_BUTTON8,
		ITEM_ID_BUTTON9, ITEM_ID_BUTTON10, ITEM_ID_BUTTON11, ITEM_ID_BUTTON12
	};

	memset(s_controls, 0, sizeof(s_controls));
	for (int pad = 0; pad < 4; pad++)
	{
		char name[16];
		sprintf(name, "Web Pad %d", pad + 1);
		input_device *device = machine.input().device_class(DEVICE_CLASS_JOYSTICK).add_device(name, &s_controls[pad][0]);
		for (int item = 0; item < WEB_CONTROL_COUNT; item++)
			device->add_item(item_names[item], item_ids[item], web_control_state, &s_controls[pad][item]);
	}
}

void web_input_exit()
{
	memset(s_controls, 0, sizeof(s_controls));
}

void web_input_set_control(int pad, int item, int pressed)
{
	if (pad >= 0 && pad < 4 && item >= 0 && item < WEB_CONTROL_COUNT)
		s_controls[pad][item] = pressed ? 0x80 : 0;
}

#endif
