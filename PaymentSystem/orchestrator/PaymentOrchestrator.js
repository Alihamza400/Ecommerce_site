// ============================================================
// PaymentOrchestrator.js — The Core Brain
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { StripeGateway }    from '../gateways/StripeGateway.js';
import { JazzCashGateway }  from '../gateways/JazzCashGateway.js';
import { EasyPaisaGateway } from '../gateways/EasyPaisaGateway.js';
import { CryptoGateway }    from '../crypto/CryptoGateway.js';
import { RoutingEngine }    from './RoutingEngine.js';
import { FailoverManager }  from './FailoverManager.js';
import { TransactionStore } from '../services/TransactionStore.js';
import logger               from '../utils/logger.js';

export class PaymentOrchestrator {

    constructor() {
        this.gateways = {
            'Stripe':    new StripeGateway(),
            'JazzCash':  new JazzCashGateway(),
            'EasyPaisa': new EasyPaisaGateway(),
            'Crypto':    new CryptoGateway()
        };
    }

    async processPayment(paymentRequest) {
        const requestId = uuidv4();
        logger.info('[Orchestrator] Payment request received', { requestId, ...paymentRequest });

        // 1. Route Request
        const primaryGatewayName = RoutingEngine.selectGateway(paymentRequest);
        
        // 2. Execute via Failover Manager
        const rawResult = await FailoverManager.executeWithFailover(
            this.gateways, 
            primaryGatewayName, 
            paymentRequest, 
            requestId
        );

        // 3. Format Response Unified
        const unifiedResponse = this._buildUnifiedResponse(
            rawResult.success,
            rawResult.gatewayUsed,
            rawResult.transactionId,
            rawResult.status,
            rawResult.metadata,
            rawResult.isFailover
        );

        // 4. Persist
        if (unifiedResponse.transactionId !== 'N/A') {
            TransactionStore.save(unifiedResponse.transactionId, {
                requestId,
                ...unifiedResponse,
                originalRequest: paymentRequest
            });
        }

        logger.info('[Orchestrator] Payment processing complete', { requestId, unifiedResponse });
        return unifiedResponse;
    }

    async processRefund(transactionId, reason) {
        const transaction = TransactionStore.get(transactionId);
        if (!transaction) {
            return this._buildUnifiedResponse(false, 'Unknown', 'N/A', 'not_found', { error: 'Transaction not found.' });
        }

        const gateway = this.gateways[transaction.gatewayUsed];
        if (!gateway) {
            return this._buildUnifiedResponse(false, 'Unknown', 'N/A', 'error', { error: 'Gateway unavailable.' });
        }

        logger.info('[Orchestrator] Refund initiated', { transactionId, gateway: transaction.gatewayUsed, reason });

        try {
            const refundResult = await gateway.refund(transactionId);
            return this._buildUnifiedResponse(true, transaction.gatewayUsed, transactionId, 'refunded', refundResult);
        } catch (err) {
            logger.error('[Orchestrator] Refund failed', { transactionId, error: err.message });
            return this._buildUnifiedResponse(false, transaction.gatewayUsed, transactionId, 'refund_failed', { error: err.message });
        }
    }

    /**
     * UNIFIED RESPONSE FORMAT
     */
    _buildUnifiedResponse(success, gatewayUsed, transactionId, status, metadata = {}, isFailover = false) {
        return {
            success,
            gatewayUsed,
            transactionId,
            status,
            type: metadata.type || (gatewayUsed === 'Crypto' ? 'crypto' : 'fiat'),
            isFailover,
            metadata,
            timestamp: new Date().toISOString()
        };
    }
}
