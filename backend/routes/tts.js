import { Router } from 'express';
import WebSocket from 'ws';
import crypto from 'crypto';

const router = Router();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

// ElevenLabs voice per language
const VOICE_MAP = {
  'en': '21m00Tcm4TlvDq8ikWAM',
  'zh': 'XU6kSxQoM3FSFQH1Fg4H'
};

// Edge TTS voices (free, no API key needed)
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
  // Register IP with Microsoft's auth endpoint
  await fetch('https://edge.microsoft.com/translate/auth');

  const voice = EDGE_VOICE_MAP[lang] || EDGE_VOICE_MAP['en'];
  const connectionId = crypto.randomUUID();

  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${lang}">
  <voice name="${voice}">
    <prosody rate="0%" pitch="0%">${escapeXml(text)}</prosody>
  </voice>
</speak>`;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`wss://speech.platform.bing.com/connect?X-ConnectionId=${connectionId}`);
    const audioChunks = [];

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Edge TTS timeout'));
    }, 15000);

    ws.on('open', () => {
      // Send synthesis config
      ws.send(`Content-Type:application/json; charset=utf-8\r\nPath:speech.context\r\n\r\n${JSON.stringify({
        context: {
          synthesis: {
            audio: {
              metadataoptions: { sentenceBoundaryEnabled: false },
              outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
            }
          }
        }
      })}`);

      // Send SSML request
      ws.send(`Path:ssml\r\nX-RequestId:${connectionId}\r\nContent-Type:application/ssml+xml\r\n\r\n${ssml}`);
    });

    ws.on('message', (data) => {
      if (data instanceof Buffer || Buffer.isBuffer(data)) {
        audioChunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
      }
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      if (audioChunks.length > 0) {
        resolve(Buffer.concat(audioChunks));
      } else {
        reject(new Error('No audio data received'));
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// POST /api/tts — tries ElevenLabs first, falls back to free Edge TTS
router.post('/', async (req, res) => {
  const { text, lang } = req.body;
  if (!text) return res.status(400).json({ error: '缺少文本' });

  // If ElevenLabs is configured, try it first
  if (ELEVENLABS_API_KEY) {
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

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        res.set({
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.byteLength,
          'Cache-Control': 'public, max-age=31536000'
        });
        return res.send(Buffer.from(audioBuffer));
      }

      console.error('ElevenLabs API error:', response.status);
    } catch (err) {
      console.error('ElevenLabs error:', err.message);
    }
  }

  // Fall back to free Edge TTS
  try {
    const audioBuffer = await edgeTTS(text, lang || 'en');
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
      'Cache-Control': 'public, max-age=31536000'
    });
    res.send(audioBuffer);
  } catch (err) {
    console.error('Edge TTS error:', err.message);
    res.status(503).json({ error: '语音服务暂不可用', fallback: true });
  }
});

export default router;
