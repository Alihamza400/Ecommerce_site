/**
 * admin_users.js — Controller for Customer Management
 */

const BASE_URL = (() => {
  const proto = window.location.protocol;
  const host  = window.location.hostname || 'localhost';
  const port  = window.location.port ? `:${window.location.port}` : '';
  if (proto === 'file:') return 'http://localhost/Ecommerce_site/Backend';
  return `${proto}//${host}${port}/Ecommerce_site/Backend`;
})();

let allUsers = [];

function showAlert(text, type = 'error') {
    const box = document.getElementById('admin-alert');
    const msg = document.getElementById('admin-alert-msg');
    if (!box || !msg) return alert(text);
    box.className = `alert alert-${type} show`;
    msg.textContent = text;
    setTimeout(() => box.classList.remove('show'), 5000);
}

document.addEventListener('DOMContentLoaded', () => {
    loadUsers();
});

async function loadUsers() {
    const tbody = document.getElementById('users-tbody');
    try {
        const res = await fetch(`${BASE_URL}/admin/users.php`, { credentials: 'include' });
        const data = await res.json();
        
        if (data.success) {
            allUsers = data.users;
            renderUsers(allUsers);
            document.getElementById('stat-total-users').textContent = allUsers.length;
        } else {
            tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Failed to load: ${data.message}</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Network error.</td></tr>`;
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('users-tbody');
    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No users found.</td></tr>`;
        return;
    }

    tbody.innerHTML = users.map(u => {
        const statusClass = u.status === 'active' ? 'badge-delivered' : 'badge-cancelled';
        const roleClass = u.role === 'admin' ? 'color:var(--clr-accent); font-weight:700;' : (u.role === 'vendor' ? 'color:var(--clr-primary-light); font-weight:600;' : '');

        return `
            <tr>
                <td><span style="font-weight:600;">${u.name}</span></td>
                <td>${u.email}</td>
                <td><span style="${roleClass}">${u.role.toUpperCase()}</span></td>
                <td><span class="badge ${statusClass}">${u.status}</span></td>
                <td style="text-align:right;">
                    ${u.role !== 'admin' ? `
                        <button class="btn-action" title="${u.status === 'active' ? 'Block User' : 'Unblock User'}" onclick="toggleUserStatus(${u.id}, '${u.status === 'active' ? 'blocked' : 'active'}')">
                            <i class="ph ${u.status === 'active' ? 'ph-user-minus' : 'ph-user-plus'}"></i>
                        </button>
                    ` : '<span style="font-size:0.75rem; color:var(--clr-muted);">Master Admin</span>'}
                </td>
            </tr>
        `;
    }).join('');
}

async function toggleUserStatus(userId, newStatus) {
    if(!confirm(`Are you sure you want to ${newStatus} this user?`)) return;
    try {
        const res = await fetch(`${BASE_URL}/admin/users.php`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: userId, status: newStatus }),
            credentials: 'include'
        });
        const data = await res.json();
        if(data.success) {
            showAlert(data.message, 'success');
            loadUsers();
        } else {
            showAlert(data.message);
        }
    } catch(e) { showAlert("Network error."); }
}

function filterUsers() {
    const query = document.getElementById('user-search').value.toLowerCase();
    const filtered = allUsers.filter(u => 
        u.name.toLowerCase().includes(query) || 
        u.email.toLowerCase().includes(query)
    );
    renderUsers(filtered);
}
