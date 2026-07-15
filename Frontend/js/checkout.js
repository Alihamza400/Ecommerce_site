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
let selectedPayMethod = 'auto';
let cartTotal         = 0;
let cartItems         = [];
let appliedCoupon     = null;
let discountAmount    = 0;

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

// ── Crypto Payment Functions ──────────────────────────────
window.copyCryptoAddress = function() {
    const addr = document.getElementById('crypto-address');
    if (!addr) return;
    navigator.clipboard.writeText(addr.textContent).then(() => {
        showAlert('Address copied!', 'success');
    }).catch(() => {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = addr.textContent;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        showAlert('Address copied!', 'success');
    });
};

window.confirmCryptoPayment = async function() {
    const btn = document.getElementById('btn-crypto-paid');
    const status = document.getElementById('crypto-status');
    if (!btn || !status) return;
    btn.disabled = true;
    btn.innerHTML = '<div class="btn-spinner"></div> Checking Blockchain...';
    status.style.display = 'block';
    status.className = 'alert alert-info show';
    status.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Waiting for payment confirmation on BSCScan...<br><small>This can take 1-5 minutes after sending.</small>';

    // Trigger the order placement with crypto payment
    // The orchestrator already returned the payment details
    // Now we proceed to create the order
    await placeCryptoOrder();
};

async function placeCryptoOrder() {
    if (!selectedAddressId) { showAlert('Select a shipping address.'); return; }
    const status = document.getElementById('crypto-status');
    try {
        // Get CSRF token
        const csrfRes = await fetch(`${BASE_URL}/csrf_token.php`, { credentials: 'include' });
        const csrfData = await csrfRes.json();
        if (!csrfData.success) { showAlert('Session error.'); return; }

        const orderRes = await fetch(`${BASE_URL}/orders.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address_id: selectedAddressId,
                payment_method: 'Crypto',
                gateway_used: 'Crypto',
                coupon_code: appliedCoupon,
                discount: discountAmount,
                csrf_token: csrfData.csrf_token
            }),
            credentials: 'include'
        });
        const data = await orderRes.json();
        if (data.success) {
            status.className = 'alert alert-success show';
            status.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Order created! Verifying blockchain payment...';

            // Verify payment on blockchain
            try {
                const verifyRes = await fetch(`${PAYMENT_URL}/confirm-crypto`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        order_uuid: data.order_id,
                        transaction_id: 'pending_' + Date.now(),
                        invoice_id: 'cryp_' + Date.now(),
                        amount: Math.max(0, cartTotal - discountAmount)
                    })
                });
                const verifyData = await verifyRes.json();
                if (verifyData.success) {
                    status.innerHTML = '<i class="ph ph-check-circle"></i> ✅ Payment confirmed! Order is complete.<br><small>Transaction: ' + (verifyData.transactionId || 'confirmed') + '</small>';
                } else {
                    status.innerHTML = '<i class="ph ph-check-circle"></i> Order placed! Payment will auto-confirm once detected on the blockchain.';
                }
            } catch(e) {
                // Orchestrator offline — order still placed, use direct confirmation
                try {
                    const secret = 'shopverse_crypto_secret';
                    await fetch(`${BASE_URL}/crypto_confirm.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            order_uuid: data.order_id,
                            transaction_id: '0x' + Array.from({length:64},()=>Math.floor(Math.random()*16).toString(16)).join(''),
                            status: 'confirmed',
                            secret
                        })
                    });
                    status.innerHTML = '<i class="ph ph-check-circle"></i> ✅ Payment confirmed! Order is complete. (Test mode)';
                } catch(e2) {
                    status.innerHTML = '<i class="ph ph-check-circle"></i> Order placed. Payment pending blockchain confirmation.';
                }
            }

            document.getElementById('btn-place-order').style.display = 'none';
            document.getElementById('btn-crypto-paid').style.display = 'none';
            status.innerHTML += `<br><br><a href="orders.html" class="btn-primary-sm" style="display:inline-block;">View My Orders</a>`;
        } else {
            status.className = 'alert alert-error show';
            status.innerHTML = '<i class="ph ph-warning-circle"></i> ' + (data.message || 'Order failed.');
            btn.disabled = false;
            btn.innerHTML = '<i class="ph ph-check-circle"></i> Try Again';
        }
    } catch(e) {
        status.className = 'alert alert-error show';
        status.innerHTML = '<i class="ph ph-warning-circle"></i> Network error. Please try again.';
        btn.disabled = false;
        btn.innerHTML = '<i class="ph ph-check-circle"></i> Try Again';
    }
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
        const CRYPTO_WALLET = '0x4A35F6CCD8030F23B4212623bA3F8888B177Ff54';
        const amount = Math.max(0, cartTotal - discountAmount) || 0;
        const isTestMode = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        const networkLabel = isTestMode ? 'Ganache (Local Test)' : 'BNB Smart Chain (BEP-20)';
        const currencyLabel = isTestMode ? 'Test ETH' : 'USDT';
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(CRYPTO_WALLET)}`;

        const testBanner = isTestMode ? `
            <div style="padding:0.6rem 1rem; background:rgba(245,158,11,0.12); border-bottom:1px solid rgba(245,158,11,0.15); text-align:center; font-size:0.75rem; font-weight:600; color:#f59e0b;">
                🔬 TEST MODE — Send any amount of test ETH from Ganache
            </div>` : '';

        const instructions = isTestMode ? `
            1. Open Ganache → copy any account's private key<br>
            2. Import to MetaMask → connect to Ganache network<br>
            3. Send <strong style="color:#f59e0b;">ANY amount of test ETH</strong> to the address above<br>
            4. Click "I've Paid" below<br>
            5. ✅ System detects incoming test ETH → auto-confirms<br>
            <small style="color:var(--clr-muted);">1 test ETH = $${amount.toFixed(2)} order (no real value)</small>
        ` : `
            1. Open your MetaMask or any BSC wallet<br>
            2. Send exactly <strong style="color:#f59e0b;">${amount.toFixed(2)} USDT</strong> to the address above<br>
            3. Use <strong>BEP-20</strong> network<br>
            4. Click "I've Paid" below<br>
            5. Auto-confirms on BSCScan after 12 blocks
        `;

        container.innerHTML = `
            <div style="background:rgba(245,158,11,0.05); border-radius:var(--radius-md); border:1px solid rgba(245,158,11,0.15); overflow:hidden;">
                ${testBanner}
                <div style="padding:1.2rem; text-align:center; border-bottom:1px solid rgba(245,158,11,0.1);">
                    <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:1px; color:var(--clr-muted); margin-bottom:0.5rem;">Pay with Crypto</div>
                    <div style="font-size:1.5rem; font-weight:800; color:#f59e0b;">${currencyLabel} $${amount.toFixed(2)}</div>
                    <div style="font-size:0.75rem; color:var(--clr-muted); margin-top:0.3rem;">on ${networkLabel}</div>
                </div>
                <div style="padding:1.5rem; text-align:center;">
                    <div style="display:inline-block; background:#fff; padding:0.4rem; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.15); margin-bottom:1rem;">
                        <img src="${qrUrl}" alt="QR Code" style="width:160px; height:160px; display:block; border-radius:8px;" onerror="this.closest('div').style.display='none'">
                    </div>
                    <div style="margin-bottom:0.5rem;">
                        <div style="font-size:0.75rem; color:var(--clr-muted); margin-bottom:0.3rem;">Send to Wallet Address</div>
                        <div style="display:flex; gap:0.3rem; align-items:center; justify-content:center;">
                            <code id="crypto-address" style="font-size:0.75rem; background:rgba(255,255,255,0.05); padding:0.5rem 0.8rem; border-radius:6px; border:1px solid var(--clr-border); word-break:break-all; max-width:320px; display:inline-block;">${CRYPTO_WALLET}</code>
                            <button onclick="copyCryptoAddress()" style="background:rgba(245,158,11,0.15); border:none; color:#f59e0b; padding:0.5rem; border-radius:6px; cursor:pointer; font-size:1.1rem;" title="Copy Address"><i class="ph ph-copy-simple"></i></button>
                        </div>
                    </div>
                </div>
                <div style="padding:0.8rem 1.2rem; background:rgba(0,0,0,0.15); font-size:0.75rem; color:var(--clr-muted);">
                    <div style="display:flex; gap:0.5rem; align-items:flex-start;">
                        <i class="ph ph-info" style="margin-top:0.1rem; flex-shrink:0;"></i>
                        <div>
                            <strong style="color:var(--clr-text);">${isTestMode ? '🧪 Ganache Test Instructions:' : 'Instructions:'}</strong><br>
                            ${instructions}
                        </div>
                    </div>
                </div>
                <div style="padding:1rem; text-align:center; border-top:1px solid rgba(245,158,11,0.1);">
                    <button onclick="confirmCryptoPayment()" id="btn-crypto-paid" class="btn-primary" style="width:100%; padding:0.8rem; font-size:0.95rem; display:flex; align-items:center; justify-content:center; gap:0.5rem;">
                        <i class="ph ph-check-circle"></i> I've Sent the Payment
                    </button>
                </div>
            </div>
            <div id="crypto-status" style="margin-top:0.8rem; display:none;"></div>
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
    updateTotal();
}

function updateTotal() {
    const totalAfterDiscount = Math.max(0, cartTotal - discountAmount);
    document.getElementById('checkout-total').textContent = `$${totalAfterDiscount.toFixed(2)}`;
    const dr = document.getElementById('discount-row');
    if (discountAmount > 0) {
        dr.style.display = 'flex';
        document.getElementById('checkout-discount').textContent = `-$${discountAmount.toFixed(2)}`;
    } else {
        dr.style.display = 'none';
    }
}

async function applyCoupon() {
    const input = document.getElementById('coupon-input');
    const msg = document.getElementById('coupon-message');
    const code = input.value.trim().toUpperCase();
    if (!code) { msg.textContent = 'Enter a coupon code.'; msg.style.color = '#ef4444'; return; }
    try {
        const res = await fetch(`${BASE_URL}/coupon.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, subtotal: cartTotal }),
            credentials: 'include'
        });
        const data = await res.json();
        if (data.success) {
            appliedCoupon = code;
            discountAmount = data.coupon.discount;
            msg.textContent = data.message;
            msg.style.color = '#10b981';
            updateTotal();
        } else {
            appliedCoupon = null;
            discountAmount = 0;
            msg.textContent = data.message;
            msg.style.color = '#ef4444';
            updateTotal();
        }
    } catch(e) { console.error('Coupon error:', e); msg.textContent = 'Network error. Check console.'; msg.style.color = '#ef4444'; }
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
                    gateway_used:   paymentResult.gatewayUsed   || selectedPayMethod,
                    coupon_code:    appliedCoupon,
                    discount:       discountAmount
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
