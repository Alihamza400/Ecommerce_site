# Skill: Add Payment Gateway or Modify Payment Routing

## Purpose
Automate adding new payment gateways (Stripe, JazzCash, EasyPaisa, Crypto) or modifying the failover/routing logic in the PaymentSystem Node.js service.

## When to Use
- Adding a new payment method or gateway
- Modifying gateway priority or failover logic
- Fixing payment transaction persistence
- Debugging payment orchestration issues
- Adding new payment validations or rate limits

## Architecture Overview

```
Route Request → RoutingEngine (select best gateway)
  ↓
FailoverManager (execute with automatic retry/fallback)
  ↓
Selected Gateway (Stripe, JazzCash, EasyPaisa, or Crypto)
  ↓
TransactionStore (persist all attempts)
  ↓
Unified Response (success/failure with metadata)
```

## File Structure

```
PaymentSystem/
├── server.js                  # Entry point, mounts routes
├── api/
│   └── routes.js             # POST /v1/payments/pay endpoint
├── gateways/
│   ├── BaseGateway.js        # Abstract class (extend this!)
│   ├── StripeGateway.js      # Stripe implementation
│   ├── JazzCashGateway.js    # JazzCash implementation
│   ├── EasyPaisaGateway.js   # EasyPaisa implementation
│   └── CryptoGateway.js      # Cryptocurrency implementation
├── orchestrator/
│   ├── RoutingEngine.js      # Selects gateway based on rules
│   ├── FailoverManager.js    # Executes with retry + fallback
│   └── PaymentOrchestrator.js # Orchestrates full payment flow
├── services/
│   └── TransactionStore.js   # Persists transaction history
└── utils/
    ├── logger.js             # Winston logger
    └── validator.js          # Input validation

```

## Pattern: Add a New Payment Gateway

### Step 1: Extend BaseGateway
```javascript
// File: PaymentSystem/gateways/MyGateway.js

const BaseGateway = require('./BaseGateway');

class MyGateway extends BaseGateway {
    constructor() {
        super('MyGateway');  // Name for logs + responses
        this.apiKey = process.env.MY_GATEWAY_API_KEY;
        this.apiUrl = 'https://api.mygateway.com';
    }

    // REQUIRED: Implement async process(request)
    async process(request) {
        const { amount, currency, orderId, userEmail, transactionId } = request;

        // 1. Validate input
        if (!amount || amount <= 0) {
            throw new Error('Invalid amount');
        }

        // 2. Prepare gateway-specific payload
        const payload = {
            amount_cents: Math.round(amount * 100),  // Convert to cents
            currency: currency,
            description: `Order #${orderId}`,
            customer_email: userEmail,
            merchant_order_id: transactionId,
            // ... gateway-specific fields
        };

        // 3. Call gateway API
        let response;
        try {
            response = await fetch(`${this.apiUrl}/charge`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(payload)
            });
        } catch (err) {
            throw new Error(`Network error: ${err.message}`);
        }

        // 4. Parse response
        const data = await response.json();

        // 5. Normalize to BaseGateway format
        if (data.success) {
            return {
                success: true,
                status: 'success',
                transactionId: data.transaction_id,  // Gateway-specific
                metadata: {
                    gatewayTransactionId: data.transaction_id,
                    authCode: data.auth_code,
                    // ... any other data needed for webhook/reconciliation
                }
            };
        } else {
            throw new Error(`${data.error_code}: ${data.error_message}`);
        }
    }

    // OPTIONAL: Validate if gateway can process this request
    canProcess(request) {
        // Example: only process if currency is PKR
        if (request.currency !== 'PKR') return false;
        return true;
    }
}

module.exports = MyGateway;
```

### Step 2: Register Gateway in RoutingEngine
```javascript
// File: PaymentSystem/orchestrator/RoutingEngine.js

const StripeGateway = require('../gateways/StripeGateway');
const MyGateway = require('../gateways/MyGateway');
// ... import other gateways

const GATEWAYS = [
    new StripeGateway(),    // Primary
    new MyGateway(),        // Secondary
    // ... order by preference
];

class RoutingEngine {
    static selectGateway(request) {
        // 1. Filter gateways that can handle this request
        const eligible = GATEWAYS.filter(g => g.canProcess(request));

        if (eligible.length === 0) {
            throw new Error('No eligible gateway for this request');
        }

        // 2. Return primary eligible gateway
        return eligible[0];
    }

    static getAvailableGateways(request) {
        // All eligible gateways (for failover)
        return GATEWAYS.filter(g => g.canProcess(request));
    }
}

module.exports = RoutingEngine;
```

### Step 3: Update API Endpoint (Optional)
If your gateway needs extra validation:

```javascript
// File: PaymentSystem/api/routes.js

const express = require('express');
const router = express.Router();
const PaymentOrchestrator = require('../orchestrator/PaymentOrchestrator');
const validator = require('../utils/validator');

router.post('/pay', async (req, res) => {
    try {
        // Validate request
        const { amount, currency, orderId, userEmail, paymentMethod } = req.body;
        validator.validatePaymentRequest({ amount, currency, orderId, userEmail });

        // Build request object
        const paymentRequest = {
            amount,
            currency,
            orderId,
            userEmail,
            paymentMethod,  // Can be used to pre-select gateway
            transactionId: require('uuid').v4(),
        };

        // Execute payment with orchestrator (handles routing + failover)
        const result = await PaymentOrchestrator.processPayment(paymentRequest);

        res.json(result);
    } catch (error) {
        res.status(400).json({
            success: false,
            status: 'failed',
            message: error.message
        });
    }
});

module.exports = router;
```

## Pattern: Modify Failover Logic

### Edit FailoverManager
```javascript
// File: PaymentSystem/orchestrator/FailoverManager.js

class FailoverManager {
    static async executeWithFailover(gateways, primaryGateway, request) {
        const transactionId = request.transactionId;
        const maxRetries = 2;  // Retry primary twice
        
        let lastError;

        // 1. Try primary gateway with retries
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await primaryGateway.process(request);
                
                // Success!
                await TransactionStore.save(transactionId, {
                    ...result,
                    gatewayUsed: primaryGateway.name,
                    isFailover: false,
                    attempt: attempt + 1
                });

                return result;
            } catch (err) {
                lastError = err;
                logger.error(`${primaryGateway.name} failed (attempt ${attempt + 1}): ${err.message}`);
                
                if (attempt < maxRetries) {
                    // Wait before retry (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
                }
            }
        }

        // 2. Primary exhausted; try failover gateways
        const fallbackGateways = gateways.filter(g => g.name !== primaryGateway.name);
        
        for (const fallbackGateway of fallbackGateways) {
            try {
                const result = await fallbackGateway.process(request);
                
                // Failover success!
                await TransactionStore.save(transactionId, {
                    ...result,
                    gatewayUsed: fallbackGateway.name,
                    isFailover: true,
                    primaryGatewayFailed: primaryGateway.name,
                    primaryError: lastError.message
                });

                return result;
            } catch (err) {
                logger.error(`${fallbackGateway.name} failover failed: ${err.message}`);
                continue;
            }
        }

        // 3. All gateways failed
        await TransactionStore.save(transactionId, {
            success: false,
            status: 'failed',
            gatewayUsed: null,
            isFailover: false,
            error: lastError.message
        });

        throw new Error(`All payment gateways failed. Last error: ${lastError.message}`);
    }
}

module.exports = FailoverManager;
```

## Testing Payment Flow

### Manual Testing
```bash
cd PaymentSystem

# 1. Start server
npm run dev

# 2. In another terminal, test endpoint
curl -X POST "http://localhost:4000/v1/payments/pay" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100.50,
    "currency": "USD",
    "orderId": "12345",
    "userEmail": "user@example.com"
  }'

# Expected response:
# {
#   "success": true,
#   "status": "success",
#   "gatewayUsed": "StripeGateway",
#   "transactionId": "uuid",
#   "isFailover": false,
#   "timestamp": "2026-05-06T10:30:00Z"
# }
```

### Automated Test Suite
```bash
# Run full test engine
node test_engine.js

# Output shows success/failure for each gateway
```

### Check Transaction History
```javascript
// In node REPL or via API endpoint
const TransactionStore = require('./services/TransactionStore');
const history = TransactionStore.getAll();
console.log(history);
```

## Response Format (Standard)

**Success (HTTP 200)**:
```json
{
    "success": true,
    "gatewayUsed": "StripeGateway|JazzCashGateway|EasyPaisaGateway|CryptoGateway",
    "transactionId": "uuid",
    "status": "success|pending|failed|not_found",
    "type": "fiat|crypto",
    "isFailover": false,
    "metadata": {
        "gatewayTransactionId": "...",
        "authCode": "...",
        "lastFour": "..."
    },
    "timestamp": "2026-05-06T10:30:00Z"
}
```

**Failure (HTTP 400–500)**:
```json
{
    "success": false,
    "status": "failed",
    "message": "Card declined",
    "gatewayUsed": "StripeGateway",
    "isFailover": false,
    "timestamp": "2026-05-06T10:30:00Z"
}
```

## Environment Variables

Add to `.env` file in PaymentSystem/:
```
STRIPE_API_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

JAZZCASH_MERCHANT_ID=...
JAZZCASH_MERCHANT_PASSWORD=...

EASYPAISE_MERCHANT_ID=...
EASYPAISE_SECURITY_KEY=...

CRYPTO_API_KEY=...
CRYPTO_NETWORK=testnet  # or mainnet
```

## Reference Files

- **Base gateway**: [PaymentSystem/gateways/BaseGateway.js](PaymentSystem/gateways/BaseGateway.js)
- **Stripe example**: [PaymentSystem/gateways/StripeGateway.js](PaymentSystem/gateways/StripeGateway.js)
- **Routing logic**: [PaymentSystem/orchestrator/RoutingEngine.js](PaymentSystem/orchestrator/RoutingEngine.js)
- **Failover logic**: [PaymentSystem/orchestrator/FailoverManager.js](PaymentSystem/orchestrator/FailoverManager.js)
- **Transaction storage**: [PaymentSystem/services/TransactionStore.js](PaymentSystem/services/TransactionStore.js)
- **API route**: [PaymentSystem/api/routes.js](PaymentSystem/api/routes.js)
- **Logger**: [PaymentSystem/utils/logger.js](PaymentSystem/utils/logger.js)

## Common Mistakes to Avoid

❌ **Never do this**:
```javascript
// Hardcoded API keys!
const apiKey = 'sk_test_abc123';

// Not handling decimal places (cents)
const amount = 99.99;  // Wrong! Should be 9999 cents

// Swallowing errors silently
try { ... } catch (err) { }  // No logging!

// Not validating request format
const { amount } = req.body;  // What if missing?
```

✅ **Do this instead**:
```javascript
// Use environment variables
const apiKey = process.env.STRIPE_API_KEY;

// Convert to cents
const amountCents = Math.round(amount * 100);

// Log all errors
catch (err) {
    logger.error(`Gateway error: ${err.message}`);
    throw err;
}

// Validate before processing
const validator = require('../utils/validator');
validator.validatePaymentRequest(request);
```

## Invocation

This skill is invoked when:
- User asks to "add a new payment gateway"
- User asks to "modify failover logic" or "improve payment routing"
- User asks to "fix payment issue" or "debug transaction failure"
- User wants to "implement retry logic" or "add new payment method"
