// license:BSD-3-Clause
// copyright-holders:Arcade Runtime contributors

#include "emu.h"
#include "rendersw.inc"

#include <vector>

#if defined(SDLMAME_EMSCRIPTEN)

extern void web_bridge_frame(const UINT8 *pixels, int width, int height);

typedef software_renderer<UINT32, 0,0,0, 16,8,0, false, false> web_renderer;

static render_target *s_target;
static bitmap_rgb32 s_bitmap;
static std::vector<UINT8> s_rgba;
static int s_width;
static int s_height;

bool web_video_init(running_machine &machine)
{
	s_target = machine.video().web_snapshot_target();
	if (s_target == NULL)
		return false;

	s_target->compute_minimum_size(s_width, s_height);
	s_target->set_bounds(s_width, s_height);
	s_bitmap.allocate(s_width, s_height);
	s_rgba.resize(s_width * s_height * 4);
	return true;
}

void web_video_update(bool skip_redraw)
{
	if (skip_redraw || s_target == NULL || s_width <= 0 || s_height <= 0)
		return;

	INT32 width;
	INT32 height;
	s_target->compute_minimum_size(width, height);
	if (width != s_width || height != s_height)
	{
		s_width = width;
		s_height = height;
		s_target->set_bounds(width, height);
		s_bitmap.allocate(width, height);
		s_rgba.resize(width * height * 4);
	}

	render_primitive_list &primlist = s_target->get_primitives();
	primlist.acquire_lock();
	web_renderer::draw_primitives(primlist, &s_bitmap.pix32(0), s_width, s_height, s_bitmap.rowpixels());
	primlist.release_lock();

	for (int y = 0; y < s_height; y++)
	{
		const UINT32 *source = &s_bitmap.pix32(y);
		UINT8 *destination = &s_rgba[y * s_width * 4];
		for (int x = 0; x < s_width; x++)
		{
			UINT32 pixel = source[x];
			destination[x * 4 + 0] = (pixel >> 16) & 0xff;
			destination[x * 4 + 1] = (pixel >> 8) & 0xff;
			destination[x * 4 + 2] = pixel & 0xff;
			destination[x * 4 + 3] = 0xff;
		}
	}

	web_bridge_frame(&s_rgba[0], s_width, s_height);
}

void web_video_exit()
{
	s_target = NULL;
	s_width = 0;
	s_height = 0;
	s_bitmap.reset();
	s_rgba.clear();
}

int web_video_width()
{
	return s_width;
}

int web_video_height()
{
	return s_height;
}

#endif
