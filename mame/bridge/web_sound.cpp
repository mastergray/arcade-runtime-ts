// license:BSD-3-Clause
// copyright-holders:Arcade Runtime contributors

#include "modules/sound/sound_module.h"
#include "modules/osdmodule.h"

#include <vector>

#if defined(SDLMAME_EMSCRIPTEN)

extern void web_bridge_sound(const float *samples, int frames);

class sound_web : public osd_module, public sound_module
{
public:
	sound_web() : osd_module(OSD_SOUND_PROVIDER, "web"), sound_module() { }
	virtual ~sound_web() { }

	virtual int init(const osd_options &options) { return 0; }
	virtual void exit() { m_samples.clear(); }

	virtual void update_audio_stream(bool is_throttled, const INT16 *buffer, int samples_this_frame)
	{
		m_samples.resize(samples_this_frame * 2);
		for (int index = 0; index < samples_this_frame * 2; index++)
			m_samples[index] = float(buffer[index]) / 32768.0f;
		if (!m_samples.empty())
			web_bridge_sound(&m_samples[0], samples_this_frame);
	}

	virtual void set_mastervolume(int attenuation) { }

private:
	std::vector<float> m_samples;
};

#else

	MODULE_NOT_SUPPORTED(sound_web, OSD_SOUND_PROVIDER, "web")

#endif

MODULE_DEFINITION(SOUND_WEB, sound_web)
