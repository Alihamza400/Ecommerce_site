/**
 * admin_orders.js — Controller for Fulfillment Dashboard
 */

const BASE_URL = '/Ecommerce_site/Backend';

function showAlert(text, type = 'error') {
    const box = document.getElementById('admin-alert');
    const msg = document.getElementById('admin-alert-msg');
    if (!box || !msg) return alert(text);
    box.className = `alert alert-${type} show`;
    msg.textContent = text;
    setTimeout(() => box.classList.remove('show'), 5000);
}

document.addEventListener('DOMContentLoaded', () => {
    // Only allow admins
    loadOrders();
});

let allOrders = [];
let currentFilter = 'all';

async function loadOrders() {
    const tbody = document.getElementById('orders-tbody');
    try {
        const res = await fetch(`${BASE_URL}/orders.php`, { credentials: 'include' });
        const data = await res.json();
        
        if (data.success) {
            allOrders = data.orders;
            applyFilters();
            updateStats(data.orders);
        } else {
            tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Failed to load orders: ${data.message}</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Network error.</td></tr>`;
    }
}

function filterByStatus(status) {
    currentFilter = status;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase() === status || (status === 'all' && btn.textContent === 'All'));
    });
    applyFilters();
}

function searchOrders() {
    applyFilters();
}

function applyFilters() {
    const query = document.getElementById('order-search').value.toLowerCase();
    
    let filtered = allOrders;

    if (currentFilter !== 'all') {
        filtered = filtered.filter(o => o.status === currentFilter || (currentFilter === 'pending' && o.status === 'confirmed'));
    }

    if (query) {
        filtered = filtered.filter(o => 
            o.uuid.toLowerCase().includes(query) || 
            (o.customer_name && o.customer_name.toLowerCase().includes(query)) ||
            (o.city && o.city.toLowerCase().includes(query))
        );
    }

    renderOrders(filtered);
}

function renderOrders(orders) {
    const tbody = document.getElementById('orders-tbody');
    if (orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">
            <div class="empty-icon"><i class="ph ph-magnifying-glass"></i></div>
            <h3>No matching orders</h3>
            <p style="color:var(--clr-muted);">Try adjusting your search or filters.</p>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = orders.map(o => {
        const date = new Date(o.created_at).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        return `
            <tr data-id="${o.id}">
                <td>
                    <span style="font-family:monospace; font-weight:600; font-size:0.8rem; color:var(--clr-primary-light);">
                        #${o.uuid.substring(0, 8).toUpperCase()}
                    </span>
                </td>
                <td>
                    <div class="customer-info">
                        <span class="customer-name">${o.customer_name || 'Guest User'}</span>
                        <span class="customer-email">${o.city || 'No City'}, ${o.country || ''}</span>
                    </div>
                </td>
                <td>${date}</td>
                <td style="font-weight:700; color:var(--clr-text);">$${Number(o.total_amount).toFixed(2)}</td>
                <td>
                    <span class="badge badge-${o.status}">${o.status}</span>
                </td>
                <td>
                    <div style="display:flex; gap:0.5rem;">
                        ${renderActions(o)}
                        <button class="btn-action" title="View Details" onclick="viewOrderDetails('${o.uuid}')">
                            <i class="ph ph-eye"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderActions(order) {
    // Logic to show different buttons based on current status
    if (order.status === 'pending' || order.status === 'confirmed') {
        return `
            <button class="btn-action" title="Mark as Processed" onclick="updateStatus(${order.id}, 'processing')">
                <i class="ph ph-factory"></i>
            </button>
        `;
    } else if (order.status === 'processing') {
        return `
            <button class="btn-action" title="Ship Product" onclick="updateStatus(${order.id}, 'shipped')">
                <i class="ph ph-truck"></i>
            </button>
        `;
    } else if (order.status === 'shipped') {
        return `
            <button class="btn-action" title="Mark as Delivered" onclick="updateStatus(${order.id}, 'delivered')">
                <i class="ph ph-house-line"></i>
            </button>
        `;
    }
    return `<i class="ph ph-check-circle" style="color:var(--clr-success); margin-left:0.5rem;"></i>`;
}

async function updateStatus(orderId, status) {
    try {
        const res = await fetch(`${BASE_URL}/orders.php`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: orderId, status: status }),
            credentials: 'include'
        });
        const data = await res.json();
        if (data.success) {
            showAlert(`Order moved to ${status}`, 'success');
            loadOrders(); // Refresh table
        } else {
            showAlert(data.message);
        }
    } catch (e) {
        showAlert("Failed to update status.");
    }
}

async function viewOrderDetails(uuid) {
    const modal = document.getElementById('order-modal');
    const body = document.getElementById('modal-body');
    const title = document.getElementById('modal-title');
    
    modal.style.display = 'flex';
    body.innerHTML = '<div class="btn-spinner" style="display:block; border-top-color:var(--clr-primary);"></div>';
    title.textContent = `Order #${uuid.substring(0, 8).toUpperCase()}`;

    try {
        const res = await fetch(`${BASE_URL}/orders.php?uuid=${uuid}`, { credentials: 'include' });
        const data = await res.json();
        
        if (data.success) {
            const o = data.order;
            body.innerHTML = `
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:2rem; margin-bottom:2rem;">
                    <div>
                        <h4 style="color:var(--clr-muted); font-size:0.8rem; text-transform:uppercase; margin-bottom:0.5rem;">Customer Info</h4>
                        <p><strong>${o.customer_name}</strong></p>
                        <p style="color:var(--clr-muted);">${o.customer_email}</p>
                    </div>
                    <div>
                        <h4 style="color:var(--clr-muted); font-size:0.8rem; text-transform:uppercase; margin-bottom:0.5rem;">Shipping Address</h4>
                        <p>${o.address_line || 'N/A'}</p>
                        <p>${o.city || ''}, ${o.state || ''} ${o.postal_code || ''}</p>
                        <p>${o.country || ''}</p>
                    </div>
                </div>

                <div style="margin-bottom:2rem;">
                    <h4 style="color:var(--clr-muted); font-size:0.8rem; text-transform:uppercase; margin-bottom:1rem;">Order Items</h4>
                    <table style="width:100%; border-collapse:collapse;">
                        <thead>
                            <tr style="text-align:left; border-bottom:1px solid var(--clr-border);">
                                <th style="padding:0.5rem 0;">Product</th>
                                <th style="padding:0.5rem 0;">Qty</th>
                                <th style="padding:0.5rem 0; text-align:right;">Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.items.map(item => `
                                <tr style="border-bottom:1px solid var(--clr-border);">
                                    <td style="padding:0.75rem 0;">${item.product_name} <br> <small style="color:var(--clr-muted);">SKU: ${item.sku}</small></td>
                                    <td style="padding:0.75rem 0;">${item.quantity}</td>
                                    <td style="padding:0.75rem 0; text-align:right;">$${Number(item.unit_price).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="2" style="padding:1rem 0; font-weight:700;">Total</td>
                                <td style="padding:1rem 0; text-align:right; font-weight:700; color:var(--clr-primary-light); font-size:1.2rem;">$${Number(o.total_amount).toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                ${o.tracking_number ? `
                    <div style="background:rgba(6,182,212,0.1); padding:1rem; border-radius:var(--radius-md); border:1px solid rgba(6,182,212,0.2);">
                        <h4 style="color:var(--clr-accent); font-size:0.8rem; text-transform:uppercase; margin-bottom:0.5rem;">Shipment Tracking</h4>
                        <p><strong>Carrier:</strong> ${o.carrier}</p>
                        <p><strong>Tracking #:</strong> <span style="font-family:monospace; color:var(--clr-accent);">${o.tracking_number}</span></p>
                    </div>
                ` : ''}
            `;
        } else {
            body.innerHTML = `<p style="color:var(--clr-error);">${data.message}</p>`;
        }
    } catch (e) {
        body.innerHTML = `<p style="color:var(--clr-error);">Network error.</p>`;
    }
}

function closeModal() {
    document.getElementById('order-modal').style.display = 'none';
}

function updateStats(orders) {
    document.getElementById('stat-total').textContent = orders.length;
    document.getElementById('stat-pending').textContent = orders.filter(o => o.status === 'pending' || o.status === 'confirmed').length;
    document.getElementById('stat-shipped').textContent = orders.filter(o => o.status === 'shipped').length;
    document.getElementById('stat-delivered').textContent = orders.filter(o => o.status === 'delivered').length;
}
