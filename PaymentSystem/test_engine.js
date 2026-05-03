import fetch from 'node-fetch';

async function testEngine() {
    console.log('🚀 Testing Advanced Payment Orchestration Engine...\n');

    const BASE_URL = 'http://localhost:4000/v1/payments';

    const testCases = [
        {
            name: "1. Fiat PK Routing (JazzCash/Easypaisa)",
            payload: { amount: 5000, currency: "PKR", country: "PK", customer: { name: "Ali", phone: "03001234567" } }
        },
        {
            name: "2. Fiat International Routing (Stripe)",
            payload: { amount: 150, currency: "USD", country: "US", customer: { name: "John", email: "john@test.com" } }
        },
        {
            name: "3. High Value PK (Stripe Priority)",
            payload: { amount: 150000, currency: "PKR", country: "PK", customer: { name: "Sara", phone: "03001234567" } }
        },
        {
            name: "4. Crypto USDT Routing",
            payload: { amount: 50, currency: "USDT", paymentMethodHint: "crypto", customer: { name: "Crypto Bro", email: "bro@crypto.com" } }
        }
    ];

    for (const test of testCases) {
        console.log(`▶️  ${test.name}`);
        try {
            const response = await fetch(`${BASE_URL}/pay`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(test.payload)
            });
            const data = await response.json();
            
            console.log(`   ✅ Success: ${data.success}`);
            console.log(`   🏦 Gateway: ${data.gatewayUsed}`);
            console.log(`   🔑 TXN ID : ${data.transactionId}`);
            console.log(`   📦 Type   : ${data.type}`);
            console.log(`   🔄 Failover: ${data.isFailover}`);
            console.log('');
        } catch (err) {
            console.error(`   ❌ Request Failed: ${err.message}\n`);
        }
    }
}

testEngine();
