import { BasePaymentGateway } from './BaseGateway.js';

export class JazzCashGateway extends BasePaymentGateway {
    constructor() {
        super('JazzCash');
    }

    async pay(data) {
        console.log(`[JazzCash] Processing mobile wallet payment for ${data.amount} ${data.currency}...`);
        
        // JazzCash usually has higher failure rates in mock scenarios or maintenance
        const success = Math.random() > 0.2; // 80% success rate
        
        if (!success) {
            throw new Error("JazzCash: OTP verification failed or insufficient balance.");
        }

        return {
            success: true,
            transactionId: `jc_${Date.now()}`,
            status: 'completed',
            metadata: { method: 'wallet', account: data.customer?.phone, type: 'fiat' }
        };
    }

    async refund(id) {
        return { success: true, message: `JazzCash refund initiated for ${id}` };
    }

    async verify(id) {
        return { success: true, status: 'completed' };
    }
}
