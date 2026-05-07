import express from 'express';
import cors from 'cors';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import authRouter from './routes/auth.js';
import syncRouter from './routes/sync.js';
import ttsRouter from './routes/tts.js';
import paymentRouter from './routes/payment.js';
import dictRouter from './routes/dict.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:8771' }));
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRouter);
app.use('/api/sync', syncRouter);
app.use('/api/tts', ttsRouter);
app.use('/api/payment', paymentRouter);
app.use('/api/dict', dictRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
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
