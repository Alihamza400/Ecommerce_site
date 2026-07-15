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

    // For crypto payments, add wallet details and confirmation webhook
    if (result.gatewayUsed === 'Crypto' && result.success) {
        result._confirmEndpoint = `http://localhost:4000/v1/payments/confirm-crypto`;
        result._walletAddress = process.env.CRYPTO_WALLET || '0x4A35F6CCD8030F23B4212623bA3F8888B177Ff54';
        result._network = process.env.CRYPTO_NETWORK || 'BSC';
        result._currency = process.env.CRYPTO_CURRENCY || 'USDT';
    }

    const statusCode = result.success ? 200 : 502;
    return res.status(statusCode).json(result);
});

// ── POST /confirm-crypto ────────────────────────────────────
// Confirms crypto payment — verifies on blockchain and updates PHP backend
router.post('/confirm-crypto', async (req, res) => {
    const { order_uuid, transaction_id, invoice_id, amount } = req.body;
    if (!order_uuid) {
        return res.status(400).json({ success: false, message: 'Missing order UUID' });
    }

    try {
        // 1. Verify payment on blockchain (or test mode mock)
        const { BlockchainService } = await import('../crypto/BlockchainService.js');
        const payment = await BlockchainService.checkPayment(amount || 0);

        const txHash = payment ? payment.transactionId : (transaction_id || '0xmock_' + Date.now());

        // 2. Update TransactionStore if invoice exists
        if (invoice_id) {
            const tx = TransactionStore.get(invoice_id);
            if (tx) {
                tx.status = payment ? 'completed' : 'pending';
                tx.transactionId = txHash;
                TransactionStore.save(tx.requestId, tx);
            }
        }

        // 3. Notify PHP backend to update order status
        const secret = process.env.CRYPTO_WEBHOOK_SECRET || 'shopverse_crypto_secret';
        const notifyUrl = `http://localhost/Ecommerce_site/Backend/crypto_confirm.php`;
        
        const status = payment ? 'confirmed' : 'pending';
        try {
            await fetch(notifyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_uuid, transaction_id: txHash, status, secret })
            });
        } catch(e) {
            logger.warn('Failed to notify PHP backend:', e.message);
        }

        if (payment) {
            return res.json({ success: true, status: 'completed', transactionId: txHash });
        } else {
            return res.json({ success: true, status: 'pending', transactionId: txHash, message: 'Waiting for blockchain confirmation' });
        }
    } catch(err) {
        return res.status(500).json({ success: false, message: err.message });
    }
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
