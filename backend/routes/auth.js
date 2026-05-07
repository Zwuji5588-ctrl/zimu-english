import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getDb, save } from '../db.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'zimu-dev-secret-change-in-production';

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期' });
  }
}

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: '邮箱和密码不能为空' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '密码至少6位' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: '邮箱格式不正确' });
  }
  try {
    const db = getDb();
    const hash = await bcrypt.hash(password, 10);
    const existing = db.exec(`SELECT id FROM users WHERE email = ?`, [email]);
    if (existing.length && existing[0].values.length) {
      return res.status(409).json({ error: '该邮箱已注册' });
    }
    db.run(`INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)`, [email, hash, name || '']);
    const row = db.exec(`SELECT id, email, name, tier FROM users WHERE email = ?`, [email]);
    const user = row[0].values[0];
    // Create empty progress
    db.run(`INSERT INTO progress (user_id, data) VALUES (?, '{}')`, [user[0]]);
    save();
    const token = jwt.sign({ userId: user[0] }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user[0], email: user[1], name: user[2] || '', tier: user[3] } });
  } catch (err) {
    res.status(500).json({ error: '注册失败', detail: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: '请输入邮箱和密码' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: '邮箱格式不正确' });
  }
  try {
    const db = getDb();
    const rows = db.exec(`SELECT * FROM users WHERE email = ?`, [email]);
    if (!rows.length || !rows[0].values.length) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }
    const row = rows[0];
    const cols = row.columns;
    const vals = row.values[0];
    const userId = vals[cols.indexOf('id')];
    const hash = vals[cols.indexOf('password_hash')];
    const userName = vals[cols.indexOf('name')];
    const userEmail = vals[cols.indexOf('email')];
    const tier = vals[cols.indexOf('tier')];

    const ok = await bcrypt.compare(password, hash);
    if (!ok) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: userId, email: userEmail, name: userName, tier } });
  } catch (err) {
    res.status(500).json({ error: '登录失败', detail: err.message });
  }
});

router.get('/me', authenticate, (req, res) => {
  try {
    const db = getDb();
    const rows = db.exec(`SELECT id, email, name, tier, created_at FROM users WHERE id = ?`, [req.userId]);
    if (!rows.length || !rows[0].values.length) {
      return res.status(404).json({ error: '用户不存在' });
    }
    const cols = rows[0].columns;
    const vals = rows[0].values[0];
    res.json({
      user: {
        id: vals[cols.indexOf('id')],
        email: vals[cols.indexOf('email')],
        name: vals[cols.indexOf('name')],
        tier: vals[cols.indexOf('tier')],
        created_at: vals[cols.indexOf('created_at')]
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { authenticate };
export default router;
