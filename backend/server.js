import express from 'express';
import cors from 'cors';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { initDb } from './db.js';
import authRouter from './routes/auth.js';
import syncRouter from './routes/sync.js';
import ttsRouter from './routes/tts.js';
import paymentRouter from './routes/payment.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:8771' }));
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRouter);
app.use('/api/sync', syncRouter);
app.use('/api/tts', ttsRouter);
app.use('/api/payment', paymentRouter);

// ── Youdao Dictionary (inline) ──
const YOUDAO_APP_KEY = process.env.YOUDAO_APP_KEY || '';
const YOUDAO_APP_SECRET = process.env.YOUDAO_APP_SECRET || '';

function youdaoSign(q, salt, curtime) {
  const input = q.length <= 20 ? q : q.slice(0, 10) + q.length + q.slice(-10);
  return crypto.createHash('sha256').update(YOUDAO_APP_KEY + input + salt + curtime + YOUDAO_APP_SECRET).digest('hex');
}

app.get('/api/dict/lookup', async (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  if (!q) return res.status(400).json({ error: '缺少查询词' });
  if (!YOUDAO_APP_KEY || !YOUDAO_APP_SECRET) {
    return res.status(503).json({ error: '词典未配置', fallback: true });
  }
  try {
    const salt = Date.now();
    const curtime = Math.floor(Date.now() / 1000);
    const sign = youdaoSign(q, salt, curtime);
    const params = new URLSearchParams({ q, from: 'en', to: 'zh-CHS', appKey: YOUDAO_APP_KEY, salt: String(salt), sign, signType: 'v3', curtime: String(curtime) });
    const resp = await fetch(`https://openapi.youdao.com/api?${params}`);
    const data = await resp.json();
    if (data.errorCode !== '0') {
      console.error('Youdao error:', data.errorCode, data.msg);
      return res.status(502).json({ error: '查询失败', code: data.errorCode, fallback: true });
    }
    const result = {
      word: data.query || q,
      phonetic: data.basic?.phonetic || '',
      ukPhonetic: data.basic?.['uk-phonetic'] || '',
      usPhonetic: data.basic?.['us-phonetic'] || '',
      audio: data.speakUrl || '',
      meanings: [],
      from: 'youdao',
    };
    if (data.basic?.explains) {
      result.meanings.push({
        partOfSpeech: '',
        definitions: data.basic.explains.map(e => ({ definition: e, example: '' }))
      });
    }
    if (data.web) {
      result.web = data.web.slice(0, 5).map(w => ({ key: w.key, values: w.value }));
    }
    res.json(result);
  } catch (err) {
    console.error('Youdao error:', err.message);
    res.status(502).json({ error: '词典服务异常', fallback: true });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), version: 'v2-with-youdao' });
});

// In production, serve the built frontend as static files
const distDir = join(__dirname, '..', 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA fallback: serve index.html for non-API routes
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(join(distDir, 'index.html'));
  });
  console.log(`Serving static files from ${distDir}`);
}

initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`自牧英语运行在 http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});
