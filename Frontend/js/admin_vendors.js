/**
 * admin_vendors.js — Controller for Vendor Management (v2)
 */
console.log('admin_vendors.js loaded (v2 with Delete/Revoke)');

const BASE_URL = (() => {
  const proto = window.location.protocol;
  if (proto === 'file:') return 'http://localhost:8080/Backend';
  return window.location.pathname.includes('/Ecommerce_site/') ? '/Ecommerce_site/Backend' : '/Backend';
})();

let allVendors = [];

function showAlert(text, type = 'error') {
    const box = document.getElementById('admin-alert');
    const msg = document.getElementById('admin-alert-msg');
    if (!box || !msg) return alert(text);
    box.className = `alert alert-${type} show`;
    msg.textContent = text;
    setTimeout(() => box.classList.remove('show'), 5000);
}

document.addEventListener('DOMContentLoaded', () => {
    loadVendors();
});

async function loadVendors() {
    const tbody = document.getElementById('vendors-tbody');
    try {
        const res = await fetch(`${BASE_URL}/admin/vendors.php`, { credentials: 'include' });
        const data = await res.json();
        
        if (data.success) {
            allVendors = data.vendors;
            renderVendors(allVendors);
            updateStats(allVendors);
        } else {
            tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Failed to load: ${data.message}</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Network error.</td></tr>`;
    }
}

function renderVendors(vendors) {
    const tbody = document.getElementById('vendors-tbody');
    if (vendors.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No vendors found.</td></tr>`;
        return;
    }

    tbody.innerHTML = vendors.map(v => {
        const statusClass = v.vendor_status === 'active' ? 'badge-delivered' : (v.vendor_status === 'suspended' ? 'badge-cancelled' : 'badge-pending');

        return `
            <tr>
                <td><span style="font-weight:700; color:var(--clr-primary-light);">${v.store_name}</span></td>
                <td>${v.name}</td>
                <td style="color:var(--clr-muted);">${v.email}</td>
                <td><span class="badge ${statusClass}">${v.vendor_status}</span></td>
                <td style="text-align:right;">
                    <div style="display:flex; gap:0.5rem; justify-content:flex-end; flex-wrap:wrap;">
                        ${v.vendor_status === 'inactive' ? `
                            <button class="btn-approve" style="padding:0.4rem 0.8rem; background:var(--clr-success); color:#fff; border:none; border-radius:var(--radius-sm); font-weight:600; cursor:pointer;" onclick="processVendor(${v.vendor_id}, 'approve')">Approve</button>
                            <button class="btn-reject" style="padding:0.4rem 0.8rem; background:rgba(239,68,68,0.1); color:var(--clr-error); border:1px solid var(--clr-error); border-radius:var(--radius-sm); font-weight:600; cursor:pointer;" onclick="processVendor(${v.vendor_id}, 'reject')">Deny</button>
                        ` : v.vendor_status === 'active' ? `
                            <button class="btn-remove" style="padding:0.4rem 0.8rem; background:rgba(239,68,68,0.1); color:var(--clr-error); border:1px solid var(--clr-error); border-radius:var(--radius-sm); font-weight:600; cursor:pointer;" onclick="processVendor(${v.vendor_id}, 'remove')">Suspend</button>
                            <button class="btn-revoke" style="padding:0.4rem 0.8rem; background:rgba(220,38,38,0.15); color:#dc2626; border:1px solid #dc2626; border-radius:var(--radius-sm); font-weight:600; cursor:pointer;" onclick="processVendor(${v.vendor_id}, 'revoke')">Revoke</button>
                        ` : v.vendor_status === 'suspended' ? `
                            <button class="btn-restore" style="padding:0.4rem 0.8rem; background:rgba(59,130,246,0.1); color:var(--clr-primary); border:1px solid var(--clr-primary); border-radius:var(--radius-sm); font-weight:600; cursor:pointer;" onclick="processVendor(${v.vendor_id}, 'restore')">Restore</button>
                        ` : ``
                        }
                        <button class="btn-delete" style="padding:0.4rem 0.8rem; background:rgba(127,29,29,0.2); color:#ef4444; border:1px solid #7f1d1d; border-radius:var(--radius-sm); font-weight:600; cursor:pointer;" onclick="processVendor(${v.vendor_id}, 'delete')">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function processVendor(vendorId, action) {
    if(!confirm(`Are you sure you want to ${action} this vendor?`)) return;
    try {
        const res = await fetch(`${BASE_URL}/admin/vendors.php`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ vendor_id: vendorId, action: action }),
            credentials: 'include'
        });
        const data = await res.json();
        if(data.success) {
            showAlert(data.message, 'success');
            loadVendors();
        } else {
            showAlert(data.message);
        }
    } catch(e) { showAlert("Network error."); }
}

function updateStats(vendors) {
    document.getElementById('stat-active-vendors').textContent = vendors.filter(v => v.vendor_status === 'active').length;
    document.getElementById('stat-pending-vendors').textContent = vendors.filter(v => v.vendor_status === 'inactive').length;
    document.getElementById('stat-suspended-vendors').textContent = vendors.filter(v => v.vendor_status === 'suspended').length;
}

function filterVendors() {
    const query = document.getElementById('vendor-search').value.toLowerCase();
    const filtered = allVendors.filter(v => 
        v.store_name.toLowerCase().includes(query) || 
        v.name.toLowerCase().includes(query) ||
        v.email.toLowerCase().includes(query)
    );
    renderVendors(filtered);
}
