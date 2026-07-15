// ============================================================
// server.js — Application Entry Point
// ============================================================

import express from 'express';
import morgan  from 'morgan';
import dotenv  from 'dotenv';
import paymentRoutes from './api/routes.js';
import logger from './utils/logger.js';

dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ─────────────────────────────────────────────
app.use(express.json());

// HTTP request logging via morgan → piped into winston
app.use(morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) }
}));

// ── Routes ─────────────────────────────────────────────────
app.use('/v1/payments', paymentRoutes);

// Health check endpoint
app.get('/health', (_req, res) => {
    res.json({
        status: 'healthy',
        system: 'Payment Orchestration System v1.0',
        gateways: ['Stripe', 'JazzCash', 'EasyPaisa', 'Crypto'],
        crypto: {
            wallet: process.env.CRYPTO_WALLET || 'not configured',
            network: process.env.CRYPTO_NETWORK || 'BSC',
            currency: process.env.CRYPTO_CURRENCY || 'USDT'
        },
        uptime: process.uptime()
    });
});

// ── Global Error Handler ───────────────────────────────────
app.use((err, _req, res, _next) => {
    logger.error('Unhandled error', { message: err.message, stack: err.stack });
    res.status(500).json({
        success: false,
        status: 'server_error',
        message: 'An unexpected error occurred.'
    });
});

// ── Start Server ───────────────────────────────────────────
app.listen(PORT, () => {
    logger.info(`
╔════════════════════════════════════════╗
║  Payment Orchestration System v1.0     ║
║  Port     : ${PORT}                       ║
║  Gateways : Stripe, JazzCash, EasyPaisa║
║  Status   : ONLINE ✓                  ║
╚════════════════════════════════════════╝
    `);
});
