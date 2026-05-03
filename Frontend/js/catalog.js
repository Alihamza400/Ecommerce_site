// ============================================================
// catalog.js — Fetches products and manages the store UI
// ============================================================

const BASE_URL = '/Ecommerce_site/Backend';

document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
});

async function loadProducts() {
    const grid = document.getElementById('products-grid');
    if (!grid) {
        console.error("DEBUG: products-grid element not found!");
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/products.php`, { credentials: 'include' });
        if (!response.ok) {
            grid.innerHTML = `<div class="alert alert-error show">Server error: ${response.status}</div>`;
            return;
        }
        const data = await response.json();

        if (data.success) {
            renderProducts(data.products, grid);
        } else {
            grid.innerHTML = `<div class="alert alert-error show">Failed to load products: ${data.message}</div>`;
        }
    } catch (error) {
        console.error('Error fetching products:', error);
        grid.innerHTML = `<div class="alert alert-error show">Network error while fetching products.</div>`;
    }
}

function renderProducts(products, grid) {
    grid.innerHTML = '';
    
    if (products.length === 0) {
        grid.innerHTML = `<div style="text-align:center;width:100%;grid-column:1/-1;">No products found.</div>`;
        return;
    }

    products.forEach(p => {
        const icon = p.category_name === 'Electronics' ? 'ph-headphones' : 'ph-package';
        
        // Absolute path to the uploads folder located inside the Backend directory
        const imgPath = p.main_image ? `/Ecommerce_site/Backend/${p.main_image.replace(/\\/g, '/')}` : '';
        
        const imgDisplay = imgPath 
            ? `<img src="${imgPath}" onerror="this.src='https://placehold.co/300x300?text=Image+Error'" alt="${p.name}" style="width:100%; height:100%; object-fit:cover;">` 
            : `<i class="ph ${icon}"></i>`;

        const card = document.createElement('article');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="product-image">
                ${imgDisplay}
            </div>
            <div class="product-details">
                <div class="product-brand">${p.brand || p.category_name || 'Generic'}</div>
                <h3 class="product-title">${escapeHTML(p.name)}</h3>
                <p class="product-desc">${escapeHTML(p.description)}</p>
                <div class="product-footer">
                    <span class="product-price">$${Number(p.price || 0).toFixed(2)}</span>
                    
                    <div style="display:flex; align-items:center;">
                        <div class="qty-input-group">
                            <button class="qty-btn" onclick="changeQty('${p.id}', -1)"><i class="ph ph-minus"></i></button>
                            <span class="qty-val" id="qty-${p.id}">1</span>
                            <button class="qty-btn" onclick="changeQty('${p.id}', 1)"><i class="ph ph-plus"></i></button>
                        </div>
                        <button class="add-to-cart" aria-label="Add to cart" onclick="addToCart('${p.id}')">
                            <i class="ph ph-shopping-cart-simple"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function changeQty(id, delta) {
    const el = document.getElementById(`qty-${id}`);
    if (!el) return;
    let val = parseInt(el.textContent) + delta;
    if (val < 1) val = 1;
    if (val > 99) val = 99; // Cap at 99 for safety
    el.textContent = val;
}

async function addToCart(id) {
    const qtyEl = document.getElementById(`qty-${id}`);
    const quantity = qtyEl ? parseInt(qtyEl.textContent) : 1;

    try {
        const fd = new FormData();
        fd.append('product_id', id);
        fd.append('quantity', quantity);

        const res = await fetch(`${BASE_URL}/cart.php`, {
            method: 'POST',
            body: fd,
            credentials: 'include'
        });
        
        if (res.status === 401) {
            alert("Please sign in to add to cart.");
            window.location.href = "login.html";
            return;
        }

        const data = await res.json();
        if(data.success) {
            alert("Added to cart!");
            // In a real app we'd trigger a cart-drawer or toast here.
        } else {
            alert(data.message);
        }
    } catch(err) {
        alert("Failed to add to cart. Network error.");
    }
}

// Redundant auth logic removed. Handled by centralized session_check.js.

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag])
    );
}
