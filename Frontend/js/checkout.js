// ============================================================
// checkout.js — Checkout Flow with Payment Orchestrator Integration
//
// FLOW:
//  1. Load cart + addresses from PHP backend
//  2. User selects address + payment method
//  3. On "Place Order":
//     a. POST to Node.js Payment Orchestrator (port 4000) → get transactionId
//     b. If payment success → POST to PHP orders.php with transactionId
//     c. orders.php creates the order record, deducts stock, clears cart
// ============================================================

const BASE_URL       = '/Ecommerce_site/Backend';
const PAYMENT_URL    = 'http://localhost:4000/v1/payments'; // Payment Orchestrator

let selectedAddressId = null;
let selectedPayMethod = 'auto'; // 'auto' = let orchestrator decide
let cartTotal         = 0;
let cartItems         = [];

// ── Payment Method Definitions ─────────────────────────────
const PAYMENT_METHODS = {
    PK: [
        { id: 'jazzcash',  label: 'JazzCash',  icon: 'ph-device-mobile', color: '#e91e63' },
        { id: 'easypaisa', label: 'EasyPaisa', icon: 'ph-device-mobile', color: '#4caf50' },
        { id: 'stripe',    label: 'Card (Int.)',icon: 'ph-credit-card',   color: '#7c3aed' },
        { id: 'crypto',    label: 'Crypto',    icon: 'ph-currency-btc',   color: '#f59e0b' }
    ],
    DEFAULT: [
        { id: 'stripe',    label: 'Credit Card', icon: 'ph-credit-card',   color: '#7c3aed' },
        { id: 'crypto',    label: 'Crypto',    icon: 'ph-currency-btc',   color: '#f59e0b' },
        { id: 'jazzcash',  label: 'JazzCash',    icon: 'ph-device-mobile', color: '#e91e63', disabled: true },
        { id: 'easypaisa', label: 'EasyPaisa',   icon: 'ph-device-mobile', color: '#4caf50', disabled: true }
    ]
};

const CURRENCY_MAP = { PK: 'PKR', US: 'USD', GB: 'GBP', AE: 'AED' };

// ── Utility: Alerts / Loading ───────────────────────────────

function showAlert(text, type = 'error') {
    const box = document.getElementById('checkout-alert');
    const msg = document.getElementById('checkout-alert-msg');
    if (!box || !msg) return alert(text);
    box.className = `alert alert-${type} show`;
    msg.textContent = text;
    clearTimeout(box._timer);
    box._timer = setTimeout(() => box.classList.remove('show'), 6000);
}

function setLoading(enabled) {
    const btn = document.getElementById('btn-place-order');
    if (!btn) return;
    btn.disabled = enabled;
    btn.classList.toggle('loading', enabled);
    btn.innerHTML = enabled
        ? `<div class="btn-spinner"></div> Processing Payment...`
        : `<i class="ph ph-lock-key"></i> Place Order Securely`;
}

function showPaymentStatus(msg, type = 'info') {
    const el = document.getElementById('payment-status');
    if (!el) return;
    const colors = { info: '#7c3aed', success: '#10b981', error: '#ef4444' };
    el.style.display = 'block';
    el.style.background = `${colors[type]}22`;
    el.style.border = `1px solid ${colors[type]}55`;
    el.style.color = colors[type];
    el.textContent = msg;
}

// ── Country / Currency Change ───────────────────────────────

window.onCountryChange = function(country) {
    // Sync currency dropdown
    const currency = CURRENCY_MAP[country] || 'USD';
    document.getElementById('pay-currency').value = currency;

    // Re-render payment method cards
    renderPaymentMethods(country);
    updateGatewayHint(country);
};

function updateGatewayHint(country) {
    const hint = document.getElementById('gateway-hint-text');
    if (!hint) return;
    if (country === 'PK') {
        hint.textContent = '🇵🇰 Pakistan detected → Routing to JazzCash or EasyPaisa. Stripe available for cards.';
    } else {
        hint.textContent = `🌐 International payment → Routing to Stripe (secure card processing).`;
    }
}

function renderPaymentMethods(country = 'PK') {
    const container = document.getElementById('payment-options');
    if (!container) return;

    const methods = PAYMENT_METHODS[country] || PAYMENT_METHODS.DEFAULT;

    container.innerHTML = methods.map((m, idx) => `
        <div class="pay-card ${idx === 0 ? 'active' : ''} ${m.disabled ? 'disabled' : ''}"
             id="pay-card-${m.id}"
             onclick="selectPayMethod('${m.id}')"
             title="${m.disabled ? 'Not available for this region' : m.label}">
            <i class="ph ${m.icon}" style="color:${m.color};"></i>
            <span>${m.label}</span>
            ${m.disabled ? '<span style="font-size:0.65rem;color:var(--clr-muted);">N/A</span>' : ''}
        </div>
    `).join('');

    // Auto-select first
    selectedPayMethod = methods[0].id;
    renderPaymentCredentials(selectedPayMethod);
}

window.selectPayMethod = function(methodId) {
    selectedPayMethod = methodId;
    document.querySelectorAll('.pay-card').forEach(c => c.classList.remove('active'));
    const card = document.getElementById(`pay-card-${methodId}`);
    if (card) card.classList.add('active');
    
    renderPaymentCredentials(methodId);
};

function renderPaymentCredentials(methodId) {
    const container = document.getElementById('payment-credentials-container');
    if (!container) return;

    container.style.display = 'block';

    if (methodId === 'stripe') {
        container.innerHTML = `
            <div style="margin-bottom:0.5rem; font-weight:600; font-size:0.9rem;"><i class="ph ph-credit-card"></i> Credit Card Details (Mock)</div>
            <p style="font-size:0.75rem; color:var(--clr-muted); margin-bottom:1rem;">We are using a mock backend. Enter any details to test.</p>
            <div class="form-group" style="margin-bottom:0.75rem;">
                <input type="text" class="form-input" placeholder="Card Number (e.g., 4242 4242 4242 4242)" required />
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
                <input type="text" class="form-input" placeholder="MM/YY" required />
                <input type="text" class="form-input" placeholder="CVC" required />
            </div>
        `;
    } else if (methodId === 'jazzcash' || methodId === 'easypaisa') {
        container.innerHTML = `
            <div style="margin-bottom:0.5rem; font-weight:600; font-size:0.9rem;"><i class="ph ph-device-mobile"></i> Mobile Wallet (Mock)</div>
            <p style="font-size:0.75rem; color:var(--clr-muted); margin-bottom:1rem;">Mock simulation of JazzCash/EasyPaisa redirect flow.</p>
            <div class="form-group">
                <input type="text" class="form-input" placeholder="Enter Mobile Number (03XX-XXXXXXX)" required />
            </div>
        `;
    } else if (methodId === 'crypto') {
        const currencySelect = document.getElementById('pay-currency');
        let selectedCrypto = currencySelect ? currencySelect.value : 'USDT';
        
        // If they selected a fiat currency but clicked the Crypto card, default to USDT
        if (!['USDT', 'BTC', 'ETH'].includes(selectedCrypto)) {
            selectedCrypto = 'USDT';
        }

        const mockWallets = {
            USDT: { name: 'USDT (TRC20)', address: 'T9yD14Nj9j7xAB4dbGeiX9h8unkKZg', color: '#10b981' },
            BTC:  { name: 'Bitcoin (BTC)', address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', color: '#f59e0b' },
            ETH:  { name: 'Ethereum (ERC20)', address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', color: '#6366f1' }
        };

        const wallet = mockWallets[selectedCrypto];

        container.innerHTML = `
            <div style="margin-bottom:0.5rem; font-weight:600; font-size:0.9rem;"><i class="ph ph-currency-btc"></i> Pay with Crypto (Mock)</div>
            <p style="font-size:0.75rem; color:var(--clr-muted); margin-bottom:1rem;">Normally, a unique wallet address is generated here.</p>
            <div style="background:rgba(245,158,11,0.05); padding:1rem; border-radius:var(--radius-sm); border:1px solid rgba(245,158,11,0.2); text-align:center;">
                <div style="font-weight:700; color:${wallet.color}; margin-bottom:0.5rem;">Send amount in ${wallet.name}</div>
                <code style="font-size:0.8rem; background:white; padding:0.4rem 0.5rem; border-radius:3px; word-break:break-all; display:block; border:1px solid var(--clr-border);">${wallet.address}</code>
            </div>
        `;
    } else {
        container.style.display = 'none';
    }
}

// ── Init on DOMContentLoaded ────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    renderPaymentMethods('PK');   // Default to Pakistan
    updateGatewayHint('PK');
    loadCheckoutData();
    setupOrderPlacement();
});

// ── Data Loading ─────────────────────────────────────────────

async function loadCheckoutData() {
    // Fetch Cart
    try {
        const cartRes = await fetch(`${BASE_URL}/cart.php`, { credentials: 'include' });
        if (cartRes.status === 401) return;
        const cartData = await cartRes.json();
        if (cartData.success) {
            cartItems = cartData.items;
            cartTotal = cartData.total_amount;
            renderCartSummary(cartData.items, cartData.total_amount);
            if (cartData.items.length === 0) {
                document.getElementById('btn-place-order').disabled = true;
                showAlert("Your cart is empty. Please add items before checking out.");
            }
        }
    } catch (e) { console.error("Cart fetch failed", e); }

    // Fetch Addresses
    try {
        const addrRes  = await fetch(`${BASE_URL}/addresses.php`, { credentials: 'include' });
        const addrData = await addrRes.json();
        if (addrData.success) renderAddresses(addrData.addresses);
    } catch (e) { console.error("Address fetch failed", e); }
}

function renderCartSummary(items, total) {
    const list = document.getElementById('checkout-items');
    if (!items || items.length === 0) {
        list.innerHTML = `<div style="text-align:center; color:var(--clr-muted);">Cart is empty</div>`;
        return;
    }
    list.innerHTML = items.map(i => `
        <div class="checkout-item">
            <div class="checkout-item-img"><i class="ph ph-package"></i></div>
            <div class="checkout-item-details">
                <div class="checkout-item-title">${escapeHTML(i.product_name)}</div>
                <div class="checkout-item-qty">Qty: ${i.quantity}</div>
            </div>
            <div class="checkout-item-price">$${(i.price * i.quantity).toFixed(2)}</div>
        </div>
    `).join('');

    const fmt = `$${Number(total).toFixed(2)}`;
    document.getElementById('checkout-subtotal').textContent = fmt;
    document.getElementById('checkout-total').textContent   = fmt;
}

function renderAddresses(addresses) {
    const cont = document.getElementById('address-selection');
    if (!addresses || addresses.length === 0) {
        cont.innerHTML = `
            <div style="text-align:center; padding:2rem; border:1px dashed var(--clr-border); border-radius:var(--radius-sm);">
                <p style="margin-bottom:1rem; color:var(--clr-muted);">No saved addresses.</p>
                <a href="profile.html" class="btn-primary-sm">Add Address</a>
            </div>`;
        return;
    }
    cont.innerHTML = addresses.map((addr, idx) => {
        const sel = (addr.is_default == 1 || idx === 0) ? 'selected' : '';
        if (sel) selectedAddressId = addr.id;
        return `
            <label class="addr-option ${sel}" onclick="selectAddress(${addr.id}, this)">
                <input type="radio" name="address" value="${addr.id}" ${sel ? 'checked' : ''} style="display:none;" />
                <div style="flex:1;">
                    <div style="font-weight:600; margin-bottom:0.2rem;">${escapeHTML(addr.address_line)}</div>
                    <div style="font-size:0.8rem; color:var(--clr-muted);">
                        ${escapeHTML(addr.city)}, ${escapeHTML(addr.state || '')} ${escapeHTML(addr.postal_code)}<br/>
                        ${escapeHTML(addr.country)}
                    </div>
                </div>
                <i class="ph ph-check-circle" style="font-size:1.5rem; color:${sel ? 'var(--clr-primary)' : 'var(--clr-border)'}; margin-left:0.5rem;"></i>
            </label>`;
    }).join('');
}

window.selectAddress = function(id, el) {
    selectedAddressId = id;
    document.querySelectorAll('.addr-option').forEach(n => {
        n.classList.remove('selected');
        n.querySelector('.ph-check-circle').style.color = 'var(--clr-border)';
    });
    el.classList.add('selected');
    el.querySelector('.ph-check-circle').style.color = 'var(--clr-primary)';
};

// ── CORE: Order Placement with Payment Orchestrator ─────────

function setupOrderPlacement() {
    const btn = document.getElementById('btn-place-order');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        if (!selectedAddressId) {
            showAlert("Please select a shipping address.");
            return;
        }
        if (!cartItems.length) {
            showAlert("Your cart is empty.");
            return;
        }

        const country  = document.getElementById('pay-country').value;
        const currency = document.getElementById('pay-currency').value;

        setLoading(true);
        showPaymentStatus('Step 1/2: Contacting Payment Orchestrator...', 'info');

        // ── STEP 1: Route payment through Orchestrator ──────
        let paymentResult;
        try {
            const payRes = await fetch(`${PAYMENT_URL}/pay`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount:   cartTotal,
                    currency: currency,
                    country:  country,
                    paymentMethodHint: selectedPayMethod, // hint for orchestrator
                    customer: { name: 'ShopVerse User' }
                })
            });

            paymentResult = await payRes.json();

            if (!paymentResult.success) {
                showPaymentStatus(`Payment failed: ${paymentResult.metadata?.error || 'Gateway rejected.'}`, 'error');
                showAlert(`Payment failed via ${paymentResult.gatewayUsed}. Please try again.`);
                setLoading(false);
                return;
            }

            showPaymentStatus(
                `Step 2/2: Payment approved via ${paymentResult.gatewayUsed}${paymentResult.isFailover ? ' (failover)' : ''}. Placing order...`,
                'success'
            );

        } catch (err) {
            // Payment Orchestrator unreachable — warn but allow fallback
            console.warn('Orchestrator unreachable, using legacy flow:', err.message);
            paymentResult = { success: true, gatewayUsed: selectedPayMethod, transactionId: null };
            showPaymentStatus('Orchestrator offline — using direct payment.', 'info');
        }

        // ── STEP 2: Create order in PHP backend ─────────────
        try {
            const orderRes = await fetch(`${BASE_URL}/orders.php`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address_id:     selectedAddressId,
                    payment_method: paymentResult.gatewayUsed || selectedPayMethod,
                    transaction_id: paymentResult.transactionId || null,
                    gateway_used:   paymentResult.gatewayUsed   || selectedPayMethod
                }),
                credentials: 'include'
            });

            const orderData = await orderRes.json();
            if (orderData.success) {
                showPaymentStatus('✓ Order placed successfully!', 'success');
                showAlert(`${orderData.message} (via ${paymentResult.gatewayUsed})`, 'success');
                setTimeout(() => window.location.href = '/Ecommerce_site/Frontend/orders.html', 2000);
            } else {
                showAlert(orderData.message);
                setLoading(false);
            }
        } catch (e) {
            showAlert("Order creation failed. Network error.");
            setLoading(false);
        }
    });
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g,
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag])
    );
}
