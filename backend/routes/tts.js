import { Router } from 'express';

const router = Router();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

const VOICE_MAP = {
  'en': '21m00Tcm4TlvDq8ikWAM',
  'zh': 'XU6kSxQoM3FSFQH1Fg4H'
};

// Google Translate TTS — free, no API key required
async function googleTTS(text, lang = 'en') {
  const tl = lang === 'zh' ? 'zh-CN' : (lang === 'en-gb' ? 'en-GB' : 'en-US');
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text.slice(0, 200))}&tl=${tl}&client=tw-ob&ttsspeed=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  if (!res.ok) throw new Error('Google TTS failed: ' + res.status);
  return Buffer.from(await res.arrayBuffer());
}

router.post('/', async (req, res) => {
  const { text, lang } = req.body;
  if (!text) return res.status(400).json({ error: '缺少文本' });

  // 1) Try ElevenLabs if configured
  if (ELEVENLABS_API_KEY) {
    try {
      const voiceId = VOICE_MAP[lang] || ELEVENLABS_VOICE_ID;
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text, model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        })
      });
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        res.set({ 'Content-Type': 'audio/mpeg', 'Content-Length': buf.length, 'Cache-Control': 'public, max-age=31536000' });
        return res.send(buf);
      }
      console.error('ElevenLabs error:', r.status);
    } catch (e) { console.error('ElevenLabs exception:', e.message); }
  }

  // 2) Free Google TTS
  try {
    const audio = await googleTTS(text, lang || 'en');
    res.set({ 'Content-Type': 'audio/mpeg', 'Content-Length': audio.length, 'Cache-Control': 'public, max-age=31536000' });
    return res.send(audio);
  } catch (e) { console.error('Google TTS error:', e.message); }

  // 3) All failed — tell frontend to use browser TTS
  res.status(503).json({ error: '语音服务暂不可用', fallback: true });
});

export default router;
