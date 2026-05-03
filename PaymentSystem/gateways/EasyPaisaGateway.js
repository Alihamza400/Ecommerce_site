import { BasePaymentGateway } from './BaseGateway.js';

export class EasyPaisaGateway extends BasePaymentGateway {
    constructor() {
        super('EasyPaisa');
    }

    async pay(data) {
        console.log(`[EasyPaisa] Processing mobile wallet payment for ${data.amount} ${data.currency}...`);
        
        const success = Math.random() > 0.15;
        
        if (!success) {
            throw new Error("EasyPaisa: Gateway timeout or invalid credentials.");
        }

        return {
            success: true,
            transactionId: `ep_${Math.random().toString(16).substr(2, 8)}`,
            status: 'completed',
            metadata: { method: 'wallet', provider: 'Telenor', type: 'fiat' }
        };
    }

    async refund(id) {
        return { success: true, message: `EasyPaisa refund successful for ${id}` };
    }

    async verify(id) {
        return { success: true, status: 'completed' };
    }
}
