// ============================================================
// RoutingEngine.js — Smart Gateway Selection Logic
// ============================================================

import logger from '../utils/logger.js';

const ROUTING_RULES = {
    PK: {
        default: ['JazzCash', 'EasyPaisa'],
        highValue: 'Stripe',
        highValueThreshold: 100000
    },
    CRYPTO: {
        default: 'Crypto'
    },
    DEFAULT: {
        default: 'Stripe'
    }
};

const FALLBACK_MAP = {
    JazzCash:  'EasyPaisa',
    EasyPaisa: 'JazzCash',
    Stripe:    null,
    Crypto:    null // In advanced systems, could fallback to a secondary crypto provider
};

export class RoutingEngine {

    /**
     * Placeholder for future Machine Learning / AI routing logic.
     * @param {Object} req 
     */
    static _runAIPrediction(req) {
        // e.g., Call TensorFlow model to predict highest success probability
        return null; // For now, returns null to fall through to rule-based routing
    }

    static selectGateway(req) {
        const { country, currency, amount, riskScore = 0, paymentMethodHint } = req;

        // 1. AI/ML Prediction (Placeholder)
        const aiSuggestedGateway = this._runAIPrediction(req);
        if (aiSuggestedGateway) return aiSuggestedGateway;

        // 2. Crypto Routing
        if (paymentMethodHint === 'crypto' || ['USDT', 'BTC', 'ETH'].includes(currency?.toUpperCase())) {
            logger.info('Routing: Crypto transaction → CryptoGateway', { currency });
            return ROUTING_RULES.CRYPTO.default;
        }

        // 3. High Risk
        if (riskScore > 0.7) {
            logger.info('Routing: High-risk transaction → Stripe', { riskScore });
            return 'Stripe';
        }

        // 4. Fiat Routing - Pakistan
        if (country === 'PK' || currency === 'PKR') {
            const rule = ROUTING_RULES.PK;
            if (amount >= rule.highValueThreshold) {
                logger.info('Routing: High-value PK transaction → Stripe', { amount });
                return rule.highValue;
            }
            // Load balance
            const chosen = rule.default[Math.floor(Math.random() * rule.default.length)];
            logger.info(`Routing: PK transaction → ${chosen}`, { amount, currency });
            return chosen;
        }

        // 5. Default Fiat
        logger.info('Routing: International fiat transaction → Stripe', { country, currency });
        return ROUTING_RULES.DEFAULT.default;
    }

    static getFallback(failedGateway, req) {
        const fallback = FALLBACK_MAP[failedGateway] || null;
        logger.warn(`Failover: ${failedGateway} → ${fallback || 'NO FALLBACK AVAILABLE'}`);
        return fallback;
    }
}
