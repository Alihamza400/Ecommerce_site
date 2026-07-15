import logger from '../utils/logger.js';
import { BlockchainService } from './BlockchainService.js';

const RECEIVE_WALLET = process.env.CRYPTO_WALLET || '0x4A35F6CCD8030F23B4212623bA3F8888B177Ff54';
const USDT_DECIMALS = 18;

export class CryptoService {
    /**
     * Generate a unique payment invoice.
     * In production with BEP-20, we use the same wallet address
     * but track payments by unique order reference + exact amount.
     */
    static async generateInvoice(currency, amount) {
        const cur = (currency || 'USDT').toUpperCase();
        const invoiceId = 'cryp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);

        logger.info(`[CryptoService] Invoice ${invoiceId}: ${amount} ${cur} → ${RECEIVE_WALLET}`);

        // Get current BNB balance for gas fee check
        let bnbBalance = 0;
        try {
            bnbBalance = await BlockchainService.getBnbBalance();
        } catch(e) {}

        return {
            invoiceId,
            payAddress: RECEIVE_WALLET,
            payAmount: amount,
            payCurrency: cur,
            network: 'BSC (BEP-20)',
            expiresAt: new Date(Date.now() + 60 * 60000).toISOString(), // 60 min expiry
            bnbBalance: bnbBalance,
            bnbWarning: bnbBalance < 0.01 ? 'Low BNB balance for gas fees' : null
        };
    }

    /**
     * Check if payment has been received on the blockchain.
     * Uses BSCScan API to verify USDT (BEP-20) transfers.
     */
    static async checkConfirmations(invoiceId, expectedAmount = null) {
        // Extract amount from invoice ID or use the stored amount
        if (!expectedAmount) {
            return { invoiceId, status: 'pending', confirmations: 0, error: 'No amount specified' };
        }

        try {
            const payment = await BlockchainService.checkPayment(expectedAmount);
            if (payment) {
                logger.info(`[CryptoService] Payment confirmed! TX: ${payment.transactionId}`);
                return {
                    invoiceId,
                    status: 'confirmed',
                    confirmations: 12,
                    transactionId: payment.transactionId,
                    from: payment.from,
                    amount: payment.amount,
                    blockNumber: payment.blockNumber
                };
            }

            return {
                invoiceId,
                status: 'pending',
                confirmations: 0,
                message: 'Waiting for payment...'
            };
        } catch (err) {
            logger.error(`[CryptoService] Check error: ${err.message}`);
            return { invoiceId, status: 'error', confirmations: 0, error: err.message };
        }
    }

    /**
     * Convert fiat amount to USDT (1:1 for stablecoin).
     */
    static convertToCrypto(fiatAmount) {
        return fiatAmount;
    }
}
