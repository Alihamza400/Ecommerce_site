// cart.js — Shopping Cart Fetch Controller
// ============================================================

const BASE_URL = window.location.pathname.includes('/Ecommerce_site/') ? '/Ecommerce_site/Backend' : '/Backend';

// Centralized auth check handled by session_check.js.
function showAlert(text) {
    const box = document.getElementById('cart-alert');
    const msg = document.getElementById('cart-alert-msg');
    if (!box || !msg) return alert(text);
    box.className = 'alert alert-error show';
    msg.textContent = text;
    clearTimeout(box._timer);
    box._timer = setTimeout(() => box.classList.remove('show'), 5000);
}

document.addEventListener('DOMContentLoaded', () => {
    loadCart();
});

async function loadCart() {
    const container = document.getElementById('cart-items');
    if (!container) return;

    try {
        const res = await fetch(`${BASE_URL}/cart.php`, { credentials: 'include' });
        if (res.status === 401) { window.location.href = 'login.html'; return; }

        const data = await res.json();
        if (data.success) {
            renderCartItems(data.items, data.total_amount);
        } else {
            container.innerHTML = `<div style="text-align:center;">Failed to load cart.</div>`;
        }
    } catch(err) {
        container.innerHTML = `<div style="text-align:center;">Network Error loading cart.</div>`;
    }
}

function renderCartItems(items, subTotal) {
    const container = document.getElementById('cart-items');
    const subLabel = document.getElementById('summary-subtotal');
    const totLabel = document.getElementById('summary-total');
    const btnCheck = document.getElementById('btn-checkout');

    if (items.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 3rem 1rem; color: var(--clr-muted);">
                <i class="ph ph-shopping-cart" style="font-size: 3rem; margin-bottom: 1rem; color:var(--clr-border);"></i>
                <h3 style="color: var(--clr-text); margin-bottom: 0.5rem;">Your cart is empty</h3>
                <p style="margin-bottom: 1.5rem;">Looks like you haven't added anything yet.</p>
                <a href="index.html" class="btn-primary-sm" style="display:inline-block;">Start Shopping</a>
            </div>
        `;
        subLabel.textContent = '$0.00';
        totLabel.textContent = '$0.00';
        btnCheck.disabled = true;
        btnCheck.style.opacity = '0.5';
        return;
    }

    btnCheck.disabled = false;
    btnCheck.style.opacity = '1';
    
    // Total formatting
    const formattedTotal = `$${Number(subTotal).toFixed(2)}`;
    subLabel.textContent = formattedTotal;
    totLabel.textContent = formattedTotal;

    // Build Items
    let html = '';
    items.forEach(item => {
        const icon = item.category_name === 'Electronics' ? 'ph-headphones' : 'ph-package';
        html += `
            <div class="cart-item" data-id="${item.cart_item_id}">
                <div class="cart-img-box"><i class="ph ${icon}"></i></div>
                <div>
                    <div class="cart-item-brand">${escapeHTML(item.brand || item.category_name)}</div>
                    <div class="cart-item-title">${escapeHTML(item.product_name)}</div>
                    
                    <div class="qty-controls">
                        <button class="qty-btn" onclick="updateQty(${item.cart_item_id}, ${item.quantity - 1})"><i class="ph ph-minus"></i></button>
                        <span class="qty-val">${item.quantity}</span>
                        <button class="qty-btn" onclick="updateQty(${item.cart_item_id}, ${item.quantity + 1})"><i class="ph ph-plus"></i></button>
                    </div>
                </div>
                <div class="cart-item-price-col">
                    <div class="cart-item-price">$${Number(item.price).toFixed(2)}</div>
                    <button class="remove-btn" onclick="removeItem(${item.cart_item_id})">
                        <i class="ph ph-trash"></i> Remove
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

async function updateQty(cartItemId, newQty) {
    if (newQty <= 0) return removeItem(cartItemId);
    try {
        const res = await fetch(`${BASE_URL}/cart.php`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `cart_item_id=${cartItemId}&quantity=${newQty}`,
            credentials: 'include'
        });
        const data = await res.json();
        if(data.success) {
            loadCart(); // Reload UI
        } else {
            showAlert(data.message);
        }
    } catch(err) { showAlert("Network error"); }
}

async function removeItem(cartItemId) {
    try {
        const res = await fetch(`${BASE_URL}/cart.php?cart_item_id=${cartItemId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        const data = await res.json();
        if(data.success) {
            loadCart();
        } else {
            showAlert(data.message);
        }
    } catch(err) { showAlert("Network error"); }
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag])
    );
}
