import { BasePaymentGateway } from '../gateways/BaseGateway.js';
import { CryptoService } from './cryptoService.js';
import logger from '../utils/logger.js';

export class CryptoGateway extends BasePaymentGateway {
    constructor() {
        super('Crypto');
    }

    async pay(data) {
        logger.info(`[CryptoGateway] Real crypto payment: ${data.amount} ${data.currency}`);

        try {
            const invoice = await CryptoService.generateInvoice(data.currency, data.amount);
            // Store the expected amount for later verification
            this._expectedAmount = data.amount;

            return {
                success: true,
                transactionId: invoice.invoiceId,
                status: 'pending',
                metadata: {
                    method: 'crypto',
                    payAddress: invoice.payAddress,
                    payAmount: invoice.payAmount,
                    payCurrency: invoice.payCurrency,
                    network: invoice.network,
                    expiresAt: invoice.expiresAt,
                    bnbWarning: invoice.bnbWarning
                }
            };
        } catch (error) {
            logger.error(`[CryptoGateway] Failed: ${error.message}`);
            throw new Error(`Crypto Gateway Error: ${error.message}`);
        }
    }

    async refund(transactionId) {
        return { success: false, message: `Manual refund required for: ${transactionId}. Send USDT from your wallet manually.` };
    }

    async verify(transactionId, amount) {
        logger.info(`[CryptoGateway] Verifying ${transactionId}`);
        const result = await CryptoService.checkConfirmations(transactionId, amount);
        return {
            success: result.status === 'confirmed',
            status: result.status,
            metadata: {
                confirmations: result.confirmations,
                transactionId: result.transactionId,
                from: result.from
            }
        };
    }
}
