import express, { Router } from 'express';
import { getDb, save } from '../db.js';
import { authenticate } from './auth.js';
import crypto from 'crypto';
import QRCode from 'qrcode';

const router = Router();

const PROVIDER = process.env.PAYMENT_PROVIDER || 'dev'; // dev | payjs
const PAYJS_MCHID = process.env.PAYJS_MCHID || '';
const PAYJS_KEY = process.env.PAYJS_KEY || '';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8771';

function activatePro(userId) {
  const db = getDb();
  db.run("UPDATE users SET tier = 'pro', updated_at = datetime('now') WHERE id = ?", [userId]);
  save();
}

// ── PayJS ──────────────────────────────────────────

function payjsSign(params) {
  const str = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&') + `&key=${PAYJS_KEY}`;
  return crypto.createHash('md5').update(str).digest('hex').toUpperCase();
}

async function createPayJSOrder(userId, type = 'wechat') {
  const outTradeNo = `ZM${Date.now()}${userId}`;
  const totalFee = 1999; // ¥19.99

  const params = {
    mchid: PAYJS_MCHID,
    total_fee: String(totalFee),
    out_trade_no: outTradeNo,
    notify_url: `${BASE_URL}/api/payment/webhook`,
  };
  params.sign = payjsSign(params);

  const endpoint = type === 'alipay'
    ? 'https://payjs.cn/api/alipay_native'
    : 'https://payjs.cn/api/native';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();

  if (data.return_code !== 1) {
    throw new Error(data.return_msg || 'PayJS error');
  }

  // Store order
  const db = getDb();
  db.run(
    "INSERT INTO payment_orders (order_id, user_id, amount, status, provider) VALUES (?, ?, ?, 'pending', 'payjs')",
    [data.payjs_order_id, userId, totalFee]
  );
  save();

  // Convert weixin:// URL to QR code data URL
  const qrDataUrl = await QRCode.toDataURL(data.qrcode, { width: 280, margin: 1 });
  return { qrcode: qrDataUrl, orderId: data.payjs_order_id };
}

// ── Routes ─────────────────────────────────────────

// Create checkout / payment order
router.post('/create-checkout', authenticate, async (req, res) => {
  try {
    const type = req.body.type || 'wechat'; // wechat | alipay

    if (PROVIDER === 'payjs' && PAYJS_MCHID && PAYJS_KEY) {
      const result = await createPayJSOrder(req.userId, type);
      return res.json({ ok: true, provider: 'payjs', ...result });
    }

    // Dev mode — instant activation
    activatePro(req.userId);
    res.json({ ok: true, simulated: true });
  } catch (err) {
    console.error('Payment error:', err.message);
    res.status(500).json({ error: '创建支付失败' });
  }
});

// PayJS webhook (notified when user pays)
router.post('/webhook', express.urlencoded({ extended: true }), (req, res) => {
  if (PROVIDER !== 'payjs') return res.status(200).json({ received: true });

  const { payjs_order_id, total_fee, return_code, sign } = req.body;
  if (String(return_code) !== '1') return res.status(200).send('fail');

  // Verify sign
  const verify = payjsSign(Object.fromEntries(
    Object.entries(req.body).filter(([k]) => k !== 'sign')
  ));
  if (sign !== verify) return res.status(400).send('sign error');

  const db = getDb();
  const rows = db.exec(
    "SELECT user_id FROM payment_orders WHERE order_id = ? AND status = 'pending'",
    [payjs_order_id]
  );

  if (rows.length && rows[0].values.length) {
    const userId = rows[0].values[0][0];
    activatePro(userId);
    db.run("UPDATE payment_orders SET status = 'paid' WHERE order_id = ?", [payjs_order_id]);
    save();
  }

  res.status(200).send('success');
});

// Poll order status (frontend uses this after showing QR code)
router.get('/order/:orderId', authenticate, (req, res) => {
  const db = getDb();
  const rows = db.exec(
    "SELECT status FROM payment_orders WHERE order_id = ? AND user_id = ?",
    [req.params.orderId, req.userId]
  );
  const status = rows.length && rows[0].values.length ? rows[0].values[0][0] : 'not_found';
  res.json({ status });
});

export default router;
