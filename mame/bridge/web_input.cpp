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
	WEB_CONTROL_STICK2_UP,
	WEB_CONTROL_STICK2_DOWN,
	WEB_CONTROL_STICK2_LEFT,
	WEB_CONTROL_STICK2_RIGHT,
	WEB_CONTROL_STICK1_UP,
	WEB_CONTROL_STICK1_DOWN,
	WEB_CONTROL_STICK1_LEFT,
	WEB_CONTROL_STICK1_RIGHT,
	WEB_CONTROL_PEDAL1,
	WEB_CONTROL_PEDAL2,
	WEB_CONTROL_PEDAL3,
	WEB_CONTROL_VOLUME_UP,
	WEB_CONTROL_VOLUME_DOWN,
	WEB_CONTROL_KEY_F1,
	WEB_CONTROL_KEY_F2,
	WEB_CONTROL_KEY_F5,
	WEB_CONTROL_KEY_F6,
	WEB_CONTROL_KEY_0,
	WEB_CONTROL_KEY_1,
	WEB_CONTROL_KEY_2,
	WEB_CONTROL_KEY_3,
	WEB_CONTROL_KEY_4,
	WEB_CONTROL_KEY_5,
	WEB_CONTROL_KEY_6,
	WEB_CONTROL_KEY_7,
	WEB_CONTROL_KEY_8,
	WEB_CONTROL_KEY_9,
	WEB_CONTROL_COUNT
};

enum
{
	WEB_AXIS_X = 0,
	WEB_AXIS_Y,
	WEB_AXIS_Z,
	WEB_AXIS_RX,
	WEB_AXIS_RY,
	WEB_AXIS_RELATIVE_X,
	WEB_AXIS_RELATIVE_Y,
	WEB_AXIS_COUNT
};

const int WEB_ABSOLUTE_AXIS_COUNT = 5;

static INT32 s_controls[4][WEB_CONTROL_COUNT];
static INT32 s_axes[4][WEB_AXIS_COUNT];

static INT32 web_control_state(void *device_internal, void *item_internal)
{
	return *reinterpret_cast<INT32 *>(item_internal);
}

static INT32 web_absolute_axis_state(void *device_internal, void *item_internal)
{
	return *reinterpret_cast<INT32 *>(item_internal);
}

static INT32 web_relative_axis_state(void *device_internal, void *item_internal)
{
	INT32 *state = reinterpret_cast<INT32 *>(item_internal);
	INT32 value = *state;
	*state = 0;
	return value;
}

void web_input_init(running_machine &machine)
{
	static const char *const item_names[WEB_CONTROL_COUNT] =
	{
		"Up", "Down", "Left", "Right",
		"Button 1", "Button 2", "Button 3", "Button 4", "Button 5", "Button 6",
		"Coin", "Start", "Select", "Service", "Test", "Tilt",
		"Stick 2 Up", "Stick 2 Down", "Stick 2 Left", "Stick 2 Right",
		"Stick 1 Up", "Stick 1 Down", "Stick 1 Left", "Stick 1 Right",
		"Pedal 1", "Pedal 2", "Pedal 3",
		"Volume Up", "Volume Down", "Key F1", "Key F2", "Key F5", "Key F6",
		"Key 0", "Key 1", "Key 2", "Key 3", "Key 4",
		"Key 5", "Key 6", "Key 7", "Key 8", "Key 9"
	};
	static const input_item_id item_ids[WEB_CONTROL_COUNT] =
	{
		ITEM_ID_HAT1UP, ITEM_ID_HAT1DOWN, ITEM_ID_HAT1LEFT, ITEM_ID_HAT1RIGHT,
		ITEM_ID_BUTTON1, ITEM_ID_BUTTON2, ITEM_ID_BUTTON3, ITEM_ID_BUTTON4,
		ITEM_ID_BUTTON5, ITEM_ID_BUTTON6, ITEM_ID_BUTTON7, ITEM_ID_BUTTON8,
		ITEM_ID_BUTTON9, ITEM_ID_BUTTON10, ITEM_ID_BUTTON11, ITEM_ID_BUTTON12,
		ITEM_ID_HAT2UP, ITEM_ID_HAT2DOWN, ITEM_ID_HAT2LEFT, ITEM_ID_HAT2RIGHT,
		ITEM_ID_HAT3UP, ITEM_ID_HAT3DOWN, ITEM_ID_HAT3LEFT, ITEM_ID_HAT3RIGHT,
		ITEM_ID_BUTTON13, ITEM_ID_BUTTON14, ITEM_ID_BUTTON15,
		ITEM_ID_BUTTON16, ITEM_ID_BUTTON17, ITEM_ID_BUTTON18, ITEM_ID_BUTTON19,
		ITEM_ID_BUTTON20, ITEM_ID_BUTTON21, ITEM_ID_BUTTON22, ITEM_ID_BUTTON23,
		ITEM_ID_BUTTON24, ITEM_ID_BUTTON25, ITEM_ID_BUTTON26, ITEM_ID_BUTTON27,
		ITEM_ID_BUTTON28, ITEM_ID_BUTTON29, ITEM_ID_BUTTON30, ITEM_ID_BUTTON31
	};
	static const char *const axis_names[WEB_AXIS_COUNT] =
	{
		"X Axis", "Y Axis", "Z Axis", "RX Axis", "RY Axis", "Relative X", "Relative Y"
	};
	static const input_item_id axis_ids[WEB_AXIS_COUNT] =
	{
		ITEM_ID_XAXIS, ITEM_ID_YAXIS, ITEM_ID_ZAXIS, ITEM_ID_RXAXIS, ITEM_ID_RYAXIS,
		ITEM_ID_ADD_RELATIVE1, ITEM_ID_ADD_RELATIVE2
	};

	memset(s_controls, 0, sizeof(s_controls));
	memset(s_axes, 0, sizeof(s_axes));
	for (int pad = 0; pad < 4; pad++)
	{
		char name[16];
		sprintf(name, "Web Pad %d", pad + 1);
		input_device *device = machine.input().device_class(DEVICE_CLASS_JOYSTICK).add_device(name, &s_controls[pad][0]);
		for (int item = 0; item < WEB_CONTROL_COUNT; item++)
			device->add_item(item_names[item], item_ids[item], web_control_state, &s_controls[pad][item]);
		for (int axis = 0; axis < WEB_AXIS_COUNT; axis++)
			device->add_item(axis_names[axis], axis_ids[axis],
				axis < WEB_ABSOLUTE_AXIS_COUNT ? web_absolute_axis_state : web_relative_axis_state,
				&s_axes[pad][axis]);
	}
}

void web_input_exit()
{
	memset(s_controls, 0, sizeof(s_controls));
	memset(s_axes, 0, sizeof(s_axes));
}

void web_input_set_control(int pad, int item, int pressed)
{
	if (pad >= 0 && pad < 4 && item >= 0 && item < WEB_CONTROL_COUNT)
		s_controls[pad][item] = pressed ? 0x80 : 0;
}

void web_input_set_axis(int pad, int axis, float value)
{
	if (pad < 0 || pad >= 4 || axis < 0 || axis >= WEB_AXIS_COUNT)
		return;
	if (axis < WEB_ABSOLUTE_AXIS_COUNT)
	{
		if (value < -1.0f)
			value = -1.0f;
		else if (value > 1.0f)
			value = 1.0f;
		s_axes[pad][axis] = INT32(value * INPUT_ABSOLUTE_MAX);
	}
	else
		s_axes[pad][axis] += INT32(value * INPUT_RELATIVE_PER_PIXEL);
}

#endif
