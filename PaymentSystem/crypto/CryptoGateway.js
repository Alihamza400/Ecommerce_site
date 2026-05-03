import { BasePaymentGateway } from '../gateways/BaseGateway.js';
import { CryptoService } from './cryptoService.js';
import logger from '../utils/logger.js';

export class CryptoGateway extends BasePaymentGateway {
    constructor() {
        super('Crypto');
    }

    /**
     * @param {Object} data - { amount, currency (e.g. USDT), customer, metadata }
     */
    async pay(data) {
        logger.info(`[CryptoGateway] Initializing crypto payment for ${data.amount} ${data.currency}`);
        
        try {
            // Generate invoice/address via CryptoService
            const invoice = await CryptoService.generateInvoice(data.currency, data.amount);

            return {
                success: true,
                transactionId: invoice.invoiceId,
                status: 'pending', // Crypto is always pending until blockchain confirmation
                metadata: { 
                    method: 'crypto', 
                    payAddress: invoice.payAddress,
                    payAmount: invoice.payAmount,
                    payCurrency: invoice.payCurrency,
                    expiresAt: invoice.expiresAt
                }
            };
        } catch (error) {
            logger.error(`[CryptoGateway] Payment initiation failed: ${error.message}`);
            throw new Error(`Crypto Gateway Error: ${error.message}`);
        }
    }

    async refund(transactionId) {
        logger.warn(`[CryptoGateway] Refund requested for ${transactionId}. Crypto refunds require manual processing or specific API support.`);
        // In real world, this might call an API to send funds back to a provided wallet address
        return { success: false, message: `Manual intervention required for crypto refund: ${transactionId}` };
    }

    async verify(transactionId) {
        logger.info(`[CryptoGateway] Verifying transaction ${transactionId}`);
        const result = await CryptoService.checkConfirmations(transactionId);
        
        return {
            success: true,
            status: result.status,
            metadata: { confirmations: result.confirmations }
        };
    }
}
