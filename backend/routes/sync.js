import { Router } from 'express';
import { exec, run } from '../db.js';
import { authenticate } from './auth.js';

const router = Router();

router.use(authenticate);

router.post('/upload', async (req, res) => {
  const { data } = req.body;
  if (!data) {
    return res.status(400).json({ error: '缺少数据' });
  }
  const json = typeof data === 'string' ? data : JSON.stringify(data);
  try {
    const existing = await exec(`SELECT id FROM progress WHERE user_id = $1`, [req.userId]);
    if (existing.values.length) {
      await run(`UPDATE progress SET data = $1, updated_at = NOW() WHERE user_id = $2`, [json, req.userId]);
    } else {
      await run(`INSERT INTO progress (user_id, data) VALUES ($1, $2)`, [req.userId, json]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/download', async (req, res) => {
  try {
    const rows = await exec(`SELECT data, updated_at FROM progress WHERE user_id = $1`, [req.userId]);
    if (!rows.values.length) {
      return res.json({ data: {}, updatedAt: null });
    }
    const cols = rows.columns;
    const vals = rows.values[0];
    const rawData = vals[cols.indexOf('data')];
    const updatedAt = vals[cols.indexOf('updated_at')];
    res.json({ data: JSON.parse(rawData), updatedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
