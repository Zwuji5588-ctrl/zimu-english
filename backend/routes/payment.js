import express, { Router } from 'express';
import Stripe from 'stripe';
import { getDb, save } from '../db.js';
import { authenticate } from './auth.js';

const router = Router();
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8771';

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

router.post('/create-checkout', authenticate, async (req, res) => {
  if (!stripe) {
    // Dev mode: simulate payment — upgrade user to pro
    const db = getDb();
    db.run("UPDATE users SET tier = 'pro', updated_at = datetime('now') WHERE id = ?", [req.userId]);
    save();
    return res.json({ ok: true, simulated: true, url: null });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{
        price_data: {
          currency: 'cny',
          product_data: { name: '自牧英语 Pro 会员' },
          unit_amount: 1999,
          recurring: { interval: 'month' }
        },
        quantity: 1
      }],
      success_url: FRONTEND_URL + '?pro_success=1',
      cancel_url: FRONTEND_URL + '?pro_cancel=1',
      metadata: { userId: String(req.userId) }
    });
    res.json({ ok: true, url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: '创建支付失败' });
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.status(200).json({ received: true });
  try {
    const sig = req.headers['stripe-signature'];
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || '');
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = parseInt(session.metadata?.userId, 10);
      if (userId) {
        const db = getDb();
        db.run("UPDATE users SET tier = 'pro', updated_at = datetime('now') WHERE id = ?", [userId]);
        save();
        console.log('Pro activated for user', userId);
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

export default router;
