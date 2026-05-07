import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getOne, run } from '../db.js';

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
    const hash = await bcrypt.hash(password, 10);
    const existing = await getOne(`SELECT id FROM users WHERE email = $1`, [email]);
    if (existing) {
      return res.status(409).json({ error: '该邮箱已注册' });
    }
    await run(`INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)`, [email, hash, name || '']);
    const user = await getOne(`SELECT id, email, name, tier FROM users WHERE email = $1`, [email]);
    await run(`INSERT INTO progress (user_id, data) VALUES ($1, '{}')`, [user.id]);
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name || '', tier: user.tier } });
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
    const user = await getOne(`SELECT * FROM users WHERE email = $1`, [email]);
    if (!user) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, tier: user.tier } });
  } catch (err) {
    res.status(500).json({ error: '登录失败', detail: err.message });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await getOne(`SELECT id, email, name, tier, created_at FROM users WHERE id = $1`, [req.userId]);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { authenticate };
export default router;
