import { Router } from 'express';

const router = Router();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Rachel

// Voice ID per language
const VOICE_MAP = {
  'en': '21m00Tcm4TlvDq8ikWAM',   // Rachel (natural US English)
  'zh': 'XU6kSxQoM3FSFQH1Fg4H'    // another voice for Chinese
};

router.post('/', async (req, res) => {
  const { text, lang } = req.body;
  if (!text) return res.status(400).json({ error: '缺少文本' });

  // If no API key configured, return a signal to use browser TTS
  if (!ELEVENLABS_API_KEY) {
    return res.status(503).json({ error: 'TTS未配置', fallback: true });
  }

  try {
    const voiceId = VOICE_MAP[lang] || ELEVENLABS_VOICE_ID;
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('ElevenLabs error:', err);
      return res.status(502).json({ error: '语音服务异常', fallback: true });
    }

    const audioBuffer = await response.arrayBuffer();
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.byteLength,
      'Cache-Control': 'public, max-age=31536000'
    });
    res.send(Buffer.from(audioBuffer));
  } catch (err) {
    console.error('TTS error:', err);
    res.status(502).json({ error: '语音服务异常', fallback: true });
  }
});

export default router;
