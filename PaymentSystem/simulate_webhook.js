import fetch from 'node-fetch';

console.log('🚀 Simulating Webhooks for Local Testing...\n');

async function sendWebhook(gateway, endpoint, payload) {
    console.log(`Sending simulated ${gateway} webhook to ${endpoint}...`);
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        console.log(`✅ ${gateway} Response:`, data);
        console.log('--------------------------------------------------\n');
    } catch (error) {
        console.error(`❌ Failed to send ${gateway} webhook:`, error.message);
        console.log('⚠️  Make sure your Payment Orchestrator (node server.js) is running on port 4000!\n');
    }
}

// Simulated Stripe Event (e.g., payment intent succeeded)
const stripePayload = {
    id: "evt_test_123",
    type: "payment_intent.succeeded",
    data: {
        object: {
            id: "pi_test_123",
            amount: 29999,
            currency: "usd",
            status: "succeeded"
        }
    }
};

// Simulated JazzCash Callback
const jazzcashPayload = {
    pp_Amount: "500000",
    pp_AuthCode: "123456",
    pp_BillReference: "ref_123",
    pp_ResponseCode: "000",
    pp_ResponseMessage: "Approved",
    pp_TxnDateTime: "20260503103000",
    pp_TxnRefNo: "T123456789"
};

async function run() {
    await sendWebhook('Stripe', 'http://localhost:4000/v1/payments/webhooks/stripe', stripePayload);
    await sendWebhook('JazzCash', 'http://localhost:4000/v1/payments/webhooks/jazzcash', jazzcashPayload);
}

run();
