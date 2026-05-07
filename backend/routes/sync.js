import { Router } from 'express';
import { getDb, save } from '../db.js';
import { authenticate } from './auth.js';

const router = Router();

router.use(authenticate);

router.post('/upload', (req, res) => {
  const { data } = req.body;
  if (!data) {
    return res.status(400).json({ error: '缺少数据' });
  }
  const json = typeof data === 'string' ? data : JSON.stringify(data);
  try {
    const db = getDb();
    const existing = db.exec(`SELECT id FROM progress WHERE user_id = ?`, [req.userId]);
    if (existing.length && existing[0].values.length) {
      db.run(`UPDATE progress SET data = ?, updated_at = datetime('now') WHERE user_id = ?`, [json, req.userId]);
    } else {
      db.run(`INSERT INTO progress (user_id, data) VALUES (?, ?)`, [req.userId, json]);
    }
    save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/download', (req, res) => {
  try {
    const db = getDb();
    const rows = db.exec(`SELECT data, updated_at FROM progress WHERE user_id = ?`, [req.userId]);
    if (!rows.length || !rows[0].values.length) {
      return res.json({ data: {}, updatedAt: null });
    }
    const cols = rows[0].columns;
    const vals = rows[0].values[0];
    const rawData = vals[cols.indexOf('data')];
    const updatedAt = vals[cols.indexOf('updated_at')];
    res.json({ data: JSON.parse(rawData), updatedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
