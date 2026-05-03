// ============================================================
// routes.js — Express REST API Layer
// All endpoints return the unified response format.
// ============================================================

import express from 'express';
import { PaymentOrchestrator } from '../orchestrator/PaymentOrchestrator.js';
import { TransactionStore }    from '../services/TransactionStore.js';
import { validatePaymentRequest, validateRefundRequest } from '../utils/validator.js';
import logger from '../utils/logger.js';

import webhookHandler from '../webhooks/webhookHandler.js';

const router = express.Router();
const orchestrator = new PaymentOrchestrator();

// Mount webhooks
router.use('/webhooks', webhookHandler);

// ── POST /pay ──────────────────────────────────────────────
// Process a new payment through the orchestration system.
//
// Body: { amount, currency, country, customer: { name, email?, phone? }, riskScore? }
router.post('/pay', async (req, res) => {
    const { valid, errors } = validatePaymentRequest(req.body);

    if (!valid) {
        logger.warn('Invalid payment request', { errors, body: req.body });
        return res.status(400).json({
            success: false,
            gatewayUsed: null,
            transactionId: null,
            status: 'validation_failed',
            metadata: { errors }
        });
    }

    const result = await orchestrator.processPayment(req.body);
    const statusCode = result.success ? 200 : 502;
    return res.status(statusCode).json(result);
});

// ── POST /refund ───────────────────────────────────────────
// Initiate a refund for a completed transaction.
//
// Body: { transactionId, reason }
router.post('/refund', async (req, res) => {
    const { valid, errors } = validateRefundRequest(req.body);

    if (!valid) {
        return res.status(400).json({
            success: false,
            status: 'validation_failed',
            metadata: { errors }
        });
    }

    const { transactionId, reason } = req.body;
    const result = await orchestrator.processRefund(transactionId, reason);
    const statusCode = result.success ? 200 : 404;
    return res.status(statusCode).json(result);
});

// ── GET /status/:id ─────────────────────────────────────────
// Look up the current status of a transaction by its ID.
router.get('/status/:id', (req, res) => {
    const transaction = TransactionStore.get(req.params.id);

    if (!transaction) {
        return res.status(404).json({
            success: false,
            transactionId: req.params.id,
            status: 'not_found',
            metadata: {}
        });
    }

    return res.json({
        success: true,
        gatewayUsed: transaction.gatewayUsed,
        transactionId: req.params.id,
        status: transaction.status,
        isFailover: transaction.isFailover,
        metadata: transaction.metadata,
        timestamp: transaction.timestamp
    });
});

// ── GET /transactions ──────────────────────────────────────
// List all transactions (for admin dashboard / reporting).
router.get('/transactions', (req, res) => {
    const all = TransactionStore.getAll();
    return res.json({ success: true, count: all.length, transactions: all });
});

export default router;
