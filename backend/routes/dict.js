import { Router } from 'express';
import crypto from 'crypto';

const router = Router();

const APP_KEY = process.env.YOUDAO_APP_KEY || '';
const APP_SECRET = process.env.YOUDAO_APP_SECRET || '';

function generateSign(q, salt, curtime) {
  const input = q.length <= 20 ? q : q.slice(0, 10) + q.length + q.slice(-10);
  return crypto.createHash('sha256').update(APP_KEY + input + salt + curtime + APP_SECRET).digest('hex');
}

router.get('/lookup', async (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  if (!q) return res.status(400).json({ error: '缺少查询词' });

  if (!APP_KEY || !APP_SECRET) {
    return res.status(503).json({ error: '词典未配置', fallback: true });
  }

  try {
    const salt = Date.now();
    const curtime = Math.floor(Date.now() / 1000);
    const sign = generateSign(q, salt, curtime);

    const params = new URLSearchParams({
      q, from: 'en', to: 'zh-CHS',
      appKey: APP_KEY,
      salt: String(salt),
      sign, signType: 'v3',
      curtime: String(curtime),
    });

    const resp = await fetch(`https://openapi.youdao.com/api?${params}`);
    const data = await resp.json();

    if (data.errorCode !== '0') {
      console.error('Youdao error:', data.errorCode, data.msg);
      return res.status(502).json({ error: '查询失败', code: data.errorCode, fallback: true });
    }

    // Build unified response
    const result = {
      word: data.query || q,
      phonetic: data.basic?.phonetic || '',
      ukPhonetic: data.basic?.['uk-phonetic'] || '',
      usPhonetic: data.basic?.['us-phonetic'] || '',
      audio: data.speakUrl || '',
      ukAudio: data.speakUrl || '',
      usAudio: data.tSpeakUrl || '',
      meanings: [],
      from: 'youdao',
    };

    // Parse explains into meanings
    if (data.basic?.explains) {
      result.meanings.push({
        partOfSpeech: '',
        definitions: data.basic.explains.map(e => ({ definition: e, example: '' }))
      });
    }

    // Parse web references
    if (data.web) {
      result.web = data.web.slice(0, 5).map(w => ({
        key: w.key,
        values: w.value
      }));
    }

    res.json(result);
  } catch (err) {
    console.error('Youdao error:', err.message);
    res.status(502).json({ error: '词典服务异常', fallback: true });
  }
});

export default router;
