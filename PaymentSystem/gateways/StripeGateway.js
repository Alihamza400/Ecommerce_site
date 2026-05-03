import { BasePaymentGateway } from './BaseGateway.js';

export class StripeGateway extends BasePaymentGateway {
    constructor() {
        super('Stripe');
    }

    async pay(data) {
        console.log(`[Stripe] Processing payment of ${data.amount} ${data.currency}...`);
        
        // Mocking Stripe SDK response
        // In real world: await stripe.paymentIntents.create({...})
        const success = Math.random() > 0.1; // 90% success rate
        
        if (!success) {
            throw new Error("Stripe: Card declined or network error.");
        }

        return {
            success: true,
            transactionId: `st_${Math.random().toString(36).substr(2, 9)}`,
            status: 'completed',
            metadata: { method: 'card', brand: 'visa', type: 'fiat' }
        };
    }

    async refund(id) {
        return { success: true, message: `Refund processed for ${id}` };
    }

    async verify(id) {
        return { success: true, status: 'verified' };
    }
}
