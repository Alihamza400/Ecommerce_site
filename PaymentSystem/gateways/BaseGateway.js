/**
 * BasePaymentGateway
 * 
 * Abstract base class defining the standard interface for all payment providers.
 * Any new gateway (PayPal, Crypto, etc.) must extend this class.
 */
export class BasePaymentGateway {
    constructor(name) {
        if (this.constructor === BasePaymentGateway) {
            throw new Error("Abstract class 'BasePaymentGateway' cannot be instantiated.");
        }
        this.name = name;
    }

    /**
     * @param {Object} paymentData - { amount, currency, country, customer, metadata, paymentMethodHint }
     * @returns {Promise<{success: boolean, transactionId: string, status: string, metadata: Object}>}
     */
    async pay(paymentData) {
        throw new Error(`[${this.name}] Method 'pay()' must be implemented.`);
    }

    /**
     * @param {string} transactionId
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async refund(transactionId) {
        throw new Error(`[${this.name}] Method 'refund()' must be implemented.`);
    }

    /**
     * @param {string} transactionId
     * @returns {Promise<{success: boolean, status: string, metadata: Object}>}
     */
    async verify(transactionId) {
        throw new Error(`[${this.name}] Method 'verify()' must be implemented.`);
    }
}
