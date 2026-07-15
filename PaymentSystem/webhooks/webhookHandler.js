import express from 'express';
import logger from '../utils/logger.js';
import { TransactionStore } from '../services/TransactionStore.js';

const router = express.Router();

// Mock Idempotency Store (in memory)
// In production, this would be Redis: SETNX idempotency_key
const IdempotencyStore = new Set();

/**
 * Middleware to ensure idempotency (prevent double processing of webhooks)
 */
const checkIdempotency = (req, res, next) => {
    // Usually webhooks provide an event ID or signature
    const eventId = req.headers['stripe-signature'] || req.body?.id || req.body?.pp_TxnRefNo || req.body?.invoiceId || Date.now().toString();
    
    if (IdempotencyStore.has(eventId)) {
        logger.warn(`[Webhooks] Ignored duplicate webhook event: ${eventId}`);
        return res.status(200).json({ received: true, duplicate: true });
    }
    
    IdempotencyStore.add(eventId);
    next();
};

// ── CRYPTO WEBHOOKS ────────────────────────────────────────

router.post('/crypto', express.json(), checkIdempotency, (req, res) => {
    logger.info('[Webhooks] Crypto callback received', { body: req.body });
    
    const { invoiceId, status, payment_status } = req.body;
    const finalStatus = status || payment_status; // Handle NOWPayments vs Binance formats

    if (invoiceId) {
        // Update transaction store if the transaction exists
        const tx = TransactionStore.get(invoiceId);
        if (tx) {
            tx.status = finalStatus;
            TransactionStore.save(invoiceId, tx);
            logger.info(`[Webhooks] Updated crypto transaction ${invoiceId} status to ${finalStatus}`);
        }
    }

    res.json({ status: 'success', message: 'Crypto webhook processed' });
});

// ── FIAT WEBHOOKS ──────────────────────────────────────────

// Stripe Webhook
router.post('/stripe', express.raw({type: 'application/json'}), checkIdempotency, (req, res) => {
    logger.info('[Webhooks] Stripe webhook received');
    // In production, verify signature here using process.env.STRIPE_WEBHOOK_SECRET
    // const event = stripe.webhooks.constructEvent(req.body, sig, secret);
    
    res.json({ received: true });
});

// JazzCash Callback
router.post('/jazzcash', express.json(), checkIdempotency, (req, res) => {
    logger.info('[Webhooks] JazzCash callback received', { body: req.body });
    res.json({ status: '000', message: 'Success' });
});

// EasyPaisa Callback
router.post('/easypaisa', express.json(), checkIdempotency, (req, res) => {
    logger.info('[Webhooks] EasyPaisa callback received', { body: req.body });
    res.json({ responseCode: '0000', responseMessage: 'Success' });
});

export default router;
