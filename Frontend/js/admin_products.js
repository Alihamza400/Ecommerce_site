/**
 * admin_products.js — Controller for Inventory Management
 */

const BASE_URL = '/Ecommerce_site/Backend';

let allProducts = [];

document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
});

async function loadProducts() {
    const tbody = document.getElementById('products-tbody');
    try {
        const res = await fetch(`${BASE_URL}/products.php`, { credentials: 'include' });
        const data = await res.json();
        
        if (data.success) {
            allProducts = data.products;
            renderProducts(allProducts);
        } else {
            tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Failed to load: ${data.message}</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Network error.</td></tr>`;
    }
}

function renderProducts(products) {
    const tbody = document.getElementById('products-tbody');
    if (products.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No products found.</td></tr>`;
        return;
    }

    tbody.innerHTML = products.map(p => {
        const stock = parseInt(p.stock || 0);
        const stockClass = stock < 10 ? 'badge-cancelled' : (stock < 50 ? 'badge-pending' : 'badge-delivered');
        const stockLabel = stock < 10 ? 'Low Stock' : (stock < 50 ? 'Medium' : 'Healthy');

        const mainImg = (p.main_image && p.main_image.trim()) ? p.main_image.trim() : '';
        const imgPath = mainImg ? `/Ecommerce_site/Backend/${mainImg.replace(/\\/g, '/')}` : '';
        const imgDisplay = imgPath ? `<img src="${imgPath}" onerror="this.src='https://placehold.co/100x100?text=Error'" style="width:100%; height:100%; object-fit:cover;">` : '<i class="ph ph-image-square" style="color:var(--clr-muted); opacity:0.3;"></i>';

        return `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:1.2rem;">
                        <div class="product-img-box" onclick="triggerUpload(${p.id})" style="width:55px; height:55px; background:var(--clr-surface-2); border-radius:var(--radius-md); display:flex; align-items:center; justify-content:center; font-size:1.8rem; position:relative; overflow:hidden; border:2px dashed var(--clr-border); cursor:pointer; transition:0.3s;">
                            ${imgDisplay}
                            <div class="img-overlay" style="position:absolute; inset:0; background:rgba(124,58,237,0.4); display:flex; align-items:center; justify-content:center; opacity:0; transition:0.3s;">
                                <i class="ph ph-plus-circle" style="color:#fff; font-size:1.5rem;"></i>
                            </div>
                        </div>
                        <input type="file" id="file-${p.id}" style="display:none;" accept="image/*" onchange="handleFileUpload(${p.id})">
                        <div style="display:flex; flex-direction:column; gap:0.2rem;">
                            <span style="font-weight:700; color:#fff; font-size:1rem;">${p.name}</span>
                            <div style="display:flex; gap:0.5rem; align-items:center;">
                                <span style="font-size:0.7rem; color:var(--clr-muted); text-transform:uppercase; letter-spacing:1px;">SKU: ${p.sku || 'N/A'}</span>
                                <button onclick="triggerUpload(${p.id})" style="background:none; border:none; color:var(--clr-primary-light); cursor:pointer; font-size:0.75rem; font-weight:700; padding:0; text-decoration:underline;">Change Photo</button>
                            </div>
                        </div>
                    </div>
                </td>
                <td><span class="badge" style="background:rgba(255,255,255,0.05); color:var(--clr-muted); border:1px solid var(--clr-border);">${p.category_name}</span></td>
                <td style="font-weight:700;">$${Number(p.price).toFixed(2)}</td>
                <td>
                    <div style="display:flex; flex-direction:column; gap:0.25rem;">
                        <span style="font-size:1rem; font-weight:700; color:${stock < 10 ? 'var(--clr-error)' : '#fff'}">${stock} units</span>
                        <div style="width:100px; height:4px; background:var(--clr-surface-2); border-radius:99px; overflow:hidden;">
                            <div style="width:${Math.min(stock, 100)}%; height:100%; background:${stock < 10 ? 'var(--clr-error)' : 'var(--clr-primary-light)'};"></div>
                        </div>
                    </div>
                </td>
                <td><span class="badge ${stockClass}">${stockLabel}</span></td>
                <td style="text-align:right; display:flex; gap:0.5rem; justify-content:flex-end;">
                    <button class="btn-action" title="Edit Product"><i class="ph ph-pencil-simple"></i></button>
                    <button class="btn-action" style="color:var(--clr-error);" title="Delete Product" onclick="deleteProduct(${p.id})"><i class="ph ph-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');

    // Add CSS for hover effect
    if (!document.getElementById('admin-prod-styles')) {
        const style = document.createElement('style');
        style.id = 'admin-prod-styles';
        style.innerHTML = `
            .product-img-box:hover .img-overlay { opacity: 1 !important; }
        `;
        document.head.appendChild(style);
    }
}

function triggerUpload(productId) {
    document.getElementById(`file-${productId}`).click();
}

async function handleFileUpload(productId) {
    const fileInput = document.getElementById(`file-${productId}`);
    if (!fileInput.files || !fileInput.files[0]) return;

    const formData = new FormData();
    formData.append('product_id', productId);
    formData.append('image', fileInput.files[0]);

    try {
        const res = await fetch(`${BASE_URL}/admin/upload_product_image.php`, {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        const data = await res.json();
        
        if (data.success) {
            alert("Image updated successfully!");
            loadProducts(); // Refresh list to show new image
        } else {
            alert(data.message);
        }
    } catch (e) {
        alert("Upload failed. Network error.");
    }
}

async function deleteProduct(productId) {
    if(!confirm('Delete this product permanently?')) return;
    try {
        const res = await fetch(`${BASE_URL}/vendor_products.php`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_id: productId }),
            credentials: 'include'
        });
        const data = await res.json();
        if(data.success) { alert(data.message); loadProducts(); }
        else alert(data.message);
    } catch(e) { alert('Network error.'); }
}

function filterProducts() {
    const query = document.getElementById('product-search').value.toLowerCase();
    const filtered = allProducts.filter(p => 
        p.name.toLowerCase().includes(query) || 
        (p.sku && p.sku.toLowerCase().includes(query)) ||
        p.category_name.toLowerCase().includes(query)
    );
    renderProducts(filtered);
}
