// profile.js — Address Management Controller
// ============================================================

const BASE_URL = '/Ecommerce_site/Backend';

function showAlert(text, type='error') {
    const box = document.getElementById('profile-alert');
    const msg = document.getElementById('profile-alert-msg');
    if (!box || !msg) return alert(text);
    box.className = `alert alert-${type} show`;
    msg.textContent = text;
    clearTimeout(box._timer);
    box._timer = setTimeout(() => box.classList.remove('show'), 5000);
}

document.addEventListener('DOMContentLoaded', () => {
    loadAddresses();
    setupForm();
});

async function loadAddresses() {
    const list = document.getElementById('address-list');
    try {
        const res = await fetch(`${BASE_URL}/addresses.php`, { credentials: 'include' });
        if (res.status === 401) return;
        const data = await res.json();
        
        if(data.success) {
            if(data.addresses.length === 0) {
                list.innerHTML = `<div style="text-align:center; padding: 2rem; color:var(--clr-muted);">No addresses saved. Click 'Add New' to create one.</div>`;
            } else {
                let html = '';
                data.addresses.forEach(addr => {
                    html += `
                        <div class="address-card ${addr.is_default == 1 ? 'is-default' : ''}">
                            ${addr.is_default == 1 ? '<span class="badge-default">Default</span>' : ''}
                            <p style="margin-bottom:0.25rem; font-weight:600;">${escapeHTML(addr.address_line)}</p>
                            <p style="color:var(--clr-muted); font-size:0.9rem;">
                                ${escapeHTML(addr.city)}${addr.state ? ', ' + escapeHTML(addr.state) : ''} ${escapeHTML(addr.postal_code)}<br>
                                ${escapeHTML(addr.country)}
                            </p>
                            <div class="address-actions">
                                ${addr.is_default == 0 ? `<button onclick="makeDefault('${addr.id}')" class="btn-make-default"><i class="ph ph-star"></i> Set Default</button>` : ''}
                                <button onclick="deleteAddress('${addr.id}')" class="btn-delete"><i class="ph ph-trash"></i> Delete</button>
                            </div>
                        </div>
                    `;
                });
                list.innerHTML = html;
            }
        }
    } catch(err) { list.innerHTML = 'Error loading addresses.'; }
}

function setupForm() {
    const btn = document.getElementById('btn-save-addr');
    if(!btn) return;
    
    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const fd = new FormData();
        fd.append('address_line', document.getElementById('addr-line').value);
        fd.append('city', document.getElementById('addr-city').value);
        fd.append('state', document.getElementById('addr-state').value);
        fd.append('postal_code', document.getElementById('addr-postal').value);
        fd.append('country', document.getElementById('addr-country').value);

        btn.disabled = true;
        try {
            const res = await fetch(`${BASE_URL}/addresses.php`, { method:'POST', body: fd, credentials: 'include' });
            const data = await res.json();
            if(data.success) {
                document.getElementById('add-address-form').style.display = 'none';
                document.getElementById('add-address-form').reset();
                showAlert(data.message, 'success');
                loadAddresses();
            } else {
                showAlert(data.message);
            }
        } catch(e) { showAlert("Network error"); }
        finally { btn.disabled = false; }
    });
}

async function deleteAddress(id) {
    if(!confirm("Are you sure you want to delete this address?")) return;
    try {
        const res = await fetch(`${BASE_URL}/addresses.php?address_id=${id}`, { method:'DELETE', credentials: 'include' });
        const data = await res.json();
        if(data.success) loadAddresses();
        else showAlert(data.message);
    } catch(e) { showAlert("Network error"); }
}

async function makeDefault(id) {
    try {
        const fd = new FormData();
        fd.append('address_id', id);
        const res = await fetch(`${BASE_URL}/addresses.php`, { method:'PUT', body: fd, credentials: 'include' });
        const data = await res.json();
        if(data.success) loadAddresses();
    } catch(e) {}
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag])
    );
}
