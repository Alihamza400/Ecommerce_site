// ============================================================
// validator.js — Input validation for payment requests
// Ensures every request has required fields before processing
// ============================================================

export function validatePaymentRequest(data) {
    const errors = [];

    if (!data.amount || isNaN(data.amount) || data.amount <= 0) {
        errors.push('amount: must be a positive number.');
    }
    if (!data.currency || typeof data.currency !== 'string' || data.currency.length < 3 || data.currency.length > 4) {
        errors.push('currency: must be a 3-4 letter ISO/Crypto code (e.g., USD, PKR, USDT).');
    }
    
    const isCrypto = data.paymentMethodHint === 'crypto' || ['USDT', 'BTC', 'ETH'].includes(data.currency?.toUpperCase());
    
    if (!isCrypto && (!data.country || typeof data.country !== 'string' || data.country.length !== 2)) {
        errors.push('country: must be a 2-letter ISO code (e.g., PK, US) for fiat payments.');
    }
    
    if (!data.customer || typeof data.customer !== 'object') {
        errors.push('customer: must be an object with name and email/phone.');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

export function validateRefundRequest(data) {
    const errors = [];

    if (!data.transactionId || typeof data.transactionId !== 'string') {
        errors.push('transactionId: is required.');
    }
    if (!data.reason || typeof data.reason !== 'string') {
        errors.push('reason: refund reason is required.');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
