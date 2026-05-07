import { Router } from 'express';
import WebSocket from 'ws';
import crypto from 'crypto';

const router = Router();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

const VOICE_MAP = {
  'en': '21m00Tcm4TlvDq8ikWAM',
  'zh': 'XU6kSxQoM3FSFQH1Fg4H'
};

// Edge TTS voices
const EDGE_VOICE_MAP = {
  'en': 'Microsoft Server Speech Text to Speech Voice (en-US, JennyNeural)',
  'en-gb': 'Microsoft Server Speech Text to Speech Voice (en-GB, SoniaNeural)',
  'zh': 'Microsoft Server Speech Text to Speech Voice (zh-CN, XiaoxiaoNeural)'
};

function escapeXml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Edge TTS — completely free, no API key required
async function edgeTTS(text, lang = 'en') {
  const voice = EDGE_VOICE_MAP[lang] || EDGE_VOICE_MAP['en'];
  const connectionId = crypto.randomUUID();
  const timestamp = new Date().toISOString().replace(/\.\d+Z/, 'Z');

  // Register with Microsoft auth endpoint
  const authRes = await fetch('https://edge.microsoft.com/translate/auth', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  if (!authRes.ok) {
    throw new Error('Edge auth failed: ' + authRes.status);
  }

  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${lang}">
  <voice name="${voice}">
    <prosody rate="0%" pitch="0%">${escapeXml(text)}</prosody>
  </voice>
</speak>`;

  return new Promise((resolve, reject) => {
    const url = `wss://speech.platform.bing.com/connect?X-ConnectionId=${connectionId}&X-Timestamp=${timestamp}&appid=D4D52672-91D7-4A74-8F7C-F1C1E1D2D3D4&version=1.0`;
    const ws = new WebSocket(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const audioChunks = [];

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Edge TTS timeout'));
    }, 15000);

    ws.on('open', () => {
      // Send synthesis context
      ws.send(`Content-Type:application/json; charset=utf-8\r\nPath:speech.context\r\n\r\n${JSON.stringify({
        context: { synthesis: { audio: { metadataoptions: { sentenceBoundaryEnabled: false }, outputFormat: 'audio-24khz-48kbitrate-mono-mp3' } } }
      })}`);
      // Send SSML
      ws.send(`Path:ssml\r\nX-RequestId:${crypto.randomUUID()}\r\nContent-Type:application/ssml+xml\r\n\r\n${ssml}`);
    });

    ws.on('message', (data) => {
      if (Buffer.isBuffer(data)) {
        audioChunks.push(data);
      }
    });

    ws.on('close', (code, reason) => {
      clearTimeout(timeout);
      if (audioChunks.length > 0) {
        resolve(Buffer.concat(audioChunks));
      } else {
        reject(new Error(`Edge TTS closed (${code}): ${reason || 'no audio'}`));
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// Google Translate TTS — free HTTP fallback
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

  // 2) Try free Edge TTS
  try {
    const audio = await edgeTTS(text, lang || 'en');
    res.set({ 'Content-Type': 'audio/mpeg', 'Content-Length': audio.length, 'Cache-Control': 'public, max-age=31536000' });
    return res.send(audio);
  } catch (e) { console.error('Edge TTS error:', e.message); }

  // 3) Try Google TTS
  try {
    const audio = await googleTTS(text, lang || 'en');
    res.set({ 'Content-Type': 'audio/mpeg', 'Content-Length': audio.length, 'Cache-Control': 'public, max-age=31536000' });
    return res.send(audio);
  } catch (e) { console.error('Google TTS error:', e.message); }

  // 4) All failed — tell frontend to use browser TTS
  res.status(503).json({ error: '语音服务暂不可用', fallback: true });
});

export default router;
