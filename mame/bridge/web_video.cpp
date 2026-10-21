// license:BSD-3-Clause
// copyright-holders:Arcade Runtime contributors

#include "emu.h"
#include "rendersw.inc"

#include <vector>

#if defined(SDLMAME_EMSCRIPTEN)

extern void web_bridge_frame(const UINT8 *pixels, int width, int height);

typedef software_renderer<UINT32, 0,0,0, 16,8,0, false, false> web_renderer;

static running_machine *s_machine;
static render_target *s_live_target;
static bitmap_rgb32 s_bitmap;
static std::vector<UINT8> s_rgba;
static int s_width;
static int s_height;
static bool s_render_pending;
static bool s_live_target_ready;

bool web_video_init(running_machine &machine)
{
	s_machine = &machine;
	s_live_target = machine.render().target_alloc();
	s_live_target_ready = false;
	s_width = 0;
	s_height = 0;
	s_render_pending = false;
	return true;
}

void web_video_update(bool skip_redraw)
{
	if (!skip_redraw)
		s_render_pending = true;
}

void web_video_render()
{
	if (s_machine == NULL)
		return;
	s_render_pending = false;
	screen_device *screen = s_machine->first_screen();
	if (screen == NULL)
		return;
	if (!s_live_target_ready)
	{
		s_live_target->set_view(s_live_target->configured_view("auto", 0, 1));
		s_live_target_ready = true;
	}
	INT32 width;
	INT32 height;
	s_live_target->compute_minimum_size(width, height);
	if (width != s_width || height != s_height)
	{
		s_width = width;
		s_height = height;
		s_live_target->set_bounds(width, height);
		s_bitmap.allocate(width, height);
		s_rgba.resize(width * height * 4);
	}

	render_primitive_list &primlist = s_live_target->get_primitives();
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
	if (s_machine != NULL && s_live_target != NULL)
		s_machine->render().target_free(s_live_target);
	s_machine = NULL;
	s_live_target = NULL;
	s_live_target_ready = false;
	s_bitmap.reset();
	s_width = 0;
	s_height = 0;
	s_render_pending = false;
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
