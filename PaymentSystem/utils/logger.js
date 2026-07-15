// ============================================================
// logger.js — Winston-powered Production Logger
// Logs to console AND to daily rotating log files
// ============================================================

import { createLogger, format, transports } from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logDir = path.join(__dirname, '..', 'logs');

const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.errors({ stack: true }),
        format.json()
    ),
    defaultMeta: { service: 'payment-orchestrator' },
    transports: [
        // Console output (colored for dev)
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.printf(({ timestamp, level, message, ...meta }) => {
                    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
                    return `[${timestamp}] ${level}: ${message} ${metaStr}`;
                })
            )
        }),
        // All logs → combined.log
        new transports.File({
            filename: path.join(logDir, 'combined.log')
        }),
        // Errors only → error.log
        new transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error'
        }),
        // Transaction events → transactions.log
        new transports.File({
            filename: path.join(logDir, 'transactions.log'),
            level: 'info'
        })
    ]
});

export default logger;
