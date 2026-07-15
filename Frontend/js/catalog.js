const BASE_URL = window.location.pathname.includes('/Ecommerce_site/') ? '/Ecommerce_site/Backend' : '/Backend';

document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
});

function starHTML(rating) {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

async function loadProducts() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    try {
        const response = await fetch(`${BASE_URL}/products.php`, { credentials: 'include' });
        if (!response.ok) { grid.innerHTML = `<div class="alert alert-error show">Server error: ${response.status}</div>`; return; }
        const data = await response.json();
        if (data.success) renderProducts(data.products, grid);
        else grid.innerHTML = `<div class="alert alert-error show">Failed to load products: ${data.message}</div>`;
    } catch (error) {
        grid.innerHTML = `<div class="alert alert-error show">Network error while fetching products.</div>`;
    }
}

function renderProducts(products, grid) {
    grid.innerHTML = '';
    if (products.length === 0) { grid.innerHTML = `<div style="text-align:center;width:100%;grid-column:1/-1;">No products found.</div>`; return; }

    products.forEach((p, idx) => {
        const icon = p.category_name === 'Electronics' ? 'ph-headphones' : 'ph-package';
        const imgPath = p.main_image ? `/Ecommerce_site/Backend/${p.main_image.replace(/\\/g, '/')}` : '';
        const imgDisplay = imgPath 
            ? `<img src="${imgPath}" onerror="this.src='https://placehold.co/300x300?text=Image+Error'" alt="${p.name}" style="width:100%; height:100%; object-fit:cover;">` 
            : `<i class="ph ${icon}"></i>`;

        const stars = starHTML(parseFloat(p.avg_rating || 0));
        const reviewLabel = p.review_count > 0 ? `${stars} ${p.avg_rating} (${p.review_count})` : 'No reviews';

        const delay = Math.min((idx % 6) + 1, 6);
        const container = document.createElement('div');
        container.className = 'pin-card-container reveal-scale delay-' + delay;
        
        const card = document.createElement('div');
        card.className = 'pin-card';
        card.setAttribute('data-tilt', '');
        
        card.innerHTML = `
            <div class="pin-card-glow"></div>
            <div class="pin-card-content">
                <div class="product-image">${imgDisplay}</div>
                <div class="product-details">
                    <div class="product-brand">${p.brand || p.category_name || 'Generic'}</div>
                    <h3 class="product-title">${escapeHTML(p.name)}</h3>
                    <div style="font-size:0.85rem; color:var(--clr-accent); margin-bottom:0.5rem; cursor:pointer;" onclick="openReviewModal(${p.id}, '${escapeHTML(p.name)}')">
                        ${reviewLabel} <span style="color:var(--clr-primary-light);font-size:0.75rem;">✎ Review</span>
                    </div>
                    <p class="product-desc">${escapeHTML(p.description)}</p>
                    <div class="product-footer">
                        <span class="product-price">$${Number(p.price || 0).toFixed(2)}</span>
                        <div style="display:flex; align-items:center;">
                            <div class="qty-input-group">
                                <button class="qty-btn" onclick="changeQty('${p.id}', -1)"><i class="ph ph-minus"></i></button>
                                <span class="qty-val" id="qty-${p.id}">1</span>
                                <button class="qty-btn" onclick="changeQty('${p.id}', 1)"><i class="ph ph-plus"></i></button>
                            </div>
                            <button class="add-to-cart btn-ripple" aria-label="Add to wishlist" onclick="toggleWishlist('${p.id}', this)" style="background:none;border:1px solid var(--clr-border);color:var(--clr-error);font-size:1.2rem;" title="Wishlist"><i class="ph ph-heart"></i></button>
                            <button class="add-to-cart btn-ripple" aria-label="Add to cart" onclick="addToCart('${p.id}')"><i class="ph ph-shopping-cart-simple"></i></button>
                        </div>
                    </div>
                </div>
            </div>`;
        
        container.appendChild(card);
        grid.appendChild(container);
    });
    // Initialize 3D tilt on dynamically created pin cards
    if (window.initPinCardTilt) window.initPinCardTilt();
}

function changeQty(id, delta) {
    const el = document.getElementById(`qty-${id}`);
    if (!el) return;
    let val = parseInt(el.textContent) + delta;
    if (val < 1) val = 1;
    if (val > 99) val = 99;
    el.textContent = val;
}

async function addToCart(id) {
    const qtyEl = document.getElementById(`qty-${id}`);
    const quantity = qtyEl ? parseInt(qtyEl.textContent) : 1;
    try {
        const csrfRes = await fetch(`${BASE_URL}/csrf_token.php`, { credentials: 'include' });
        const csrfData = await csrfRes.json();
        if (!csrfData.success) { alert("Session error. Please refresh."); return; }
        const fd = new FormData();
        fd.append('csrf_token', csrfData.csrf_token);
        fd.append('product_id', id);
        fd.append('quantity', quantity);
        const res = await fetch(`${BASE_URL}/cart.php`, { method: 'POST', body: fd, credentials: 'include' });
        if (res.status === 401) { alert("Please sign in to add to cart."); window.location.href = "login.html"; return; }
        const data = await res.json();
        if(data.success) {
            if (window.showAddToCartFeedback) {
                const btns = document.querySelectorAll(`.add-to-cart[onclick*="'${id}'"]`);
                if (btns.length) window.showAddToCartFeedback(btns[1] || btns[0]);
            }
        } else alert(data.message);
    } catch(err) { alert("Failed to add to cart. Network error."); }
}

async function toggleWishlist(productId, btn) {
    try {
        const isRemove = btn.classList.contains('in-wishlist');
        const res = await fetch(`${BASE_URL}/wishlist.php`, {
            method: isRemove ? 'DELETE' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_id: productId }),
            credentials: 'include'
        });
        if (res.status === 401) { window.location.href = 'login.html'; return; }
        const data = await res.json();
        if (data.success) {
            btn.classList.toggle('in-wishlist');
            btn.style.background = isRemove ? 'none' : 'rgba(239,68,68,0.15)';
            btn.style.borderColor = isRemove ? 'var(--clr-border)' : '#ef4444';
        }
    } catch(e) {}
}

async function openReviewModal(productId, productName) {
    const existing = document.getElementById('review-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'review-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:1000;display:flex;align-items:center;justify-content:center;';

    let reviewsHTML = '<div style="text-align:center;padding:2rem;color:var(--clr-muted);">Loading reviews...</div>';
    
    try {
        const res = await fetch(`${BASE_URL}/reviews.php?product_id=${productId}`, { credentials: 'include' });
        const data = await res.json();
        if (data.success && data.reviews.length > 0) {
            reviewsHTML = data.reviews.map(r => `
                <div style="padding:0.8rem 0;border-bottom:1px solid var(--clr-border);">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <strong>${escapeHTML(r.user_name)}</strong>
                        <span style="color:var(--clr-accent);">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span>
                    </div>
                    <p style="color:var(--clr-muted);font-size:0.85rem;margin-top:0.3rem;">${escapeHTML(r.comment)}</p>
                    <small style="color:var(--clr-muted);opacity:0.6;">${new Date(r.created_at).toLocaleDateString()}</small>
                </div>
            `).join('');
            reviewsHTML = `<div style="margin-bottom:0.5rem;color:var(--clr-accent);font-size:1.1rem;">${'★'.repeat(Math.round(data.avg_rating))} ${data.avg_rating} (${data.total_reviews} reviews)</div>` + reviewsHTML;
        } else {
            reviewsHTML = '<div style="text-align:center;padding:2rem;color:var(--clr-muted);">No reviews yet. Be the first!</div>';
        }
    } catch(e) { reviewsHTML = '<div style="text-align:center;padding:2rem;color:var(--clr-error);">Failed to load reviews.</div>'; }

    overlay.innerHTML = `
        <div style="background:var(--clr-surface);border:1px solid var(--clr-border);border-radius:var(--radius-lg);width:90%;max-width:500px;max-height:80vh;overflow-y:auto;padding:2rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
                <h3 style="font-size:1.2rem;">${escapeHTML(productName)}</h3>
                <button onclick="this.closest('#review-modal-overlay').remove()" style="background:none;border:none;color:var(--clr-muted);font-size:1.5rem;cursor:pointer;">✕</button>
            </div>
            <div id="reviews-list">${reviewsHTML}</div>
            <div style="margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid var(--clr-border);">
                <h4 style="font-size:0.95rem;margin-bottom:0.8rem;">Write a Review</h4>
                <div style="margin-bottom:0.8rem;">
                    <label style="font-size:0.85rem;color:var(--clr-muted);">Rating:</label>
                    <div id="review-star-select" style="font-size:1.5rem;color:var(--clr-accent);cursor:pointer;">
                        ${[1,2,3,4,5].map(i => `<span onmouseover="hoverStar(${i})" onclick="selectStar(${i})" onmouseout="resetStar()" data-val="${i}" style="cursor:pointer;">☆</span>`).join('')}
                    </div>
                </div>
                <textarea id="review-comment" placeholder="Share your experience..." style="width:100%;padding:0.8rem;background:var(--clr-surface-2);border:1px solid var(--clr-border);border-radius:var(--radius-sm);color:#fff;resize:vertical;min-height:80px;margin-bottom:0.8rem;"></textarea>
                <button class="btn-primary" style="width:100%;" onclick="submitReview(${productId})">Submit Review</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    window._selectedRating = 0;
}

let _selectedRating = 0;
function hoverStar(val) { const spans = document.querySelectorAll('#review-star-select span'); spans.forEach((s,i) => s.textContent = i < val ? '★' : '☆'); }
function resetStar() { const spans = document.querySelectorAll('#review-star-select span'); spans.forEach((s,i) => s.textContent = i < _selectedRating ? '★' : '☆'); }
function selectStar(val) { _selectedRating = val; resetStar(); }

async function submitReview(productId) {
    const comment = document.getElementById('review-comment').value.trim();
    if (_selectedRating === 0) { alert('Please select a rating.'); return; }
    if (!comment) { alert('Please write a comment.'); return; }
    try {
        const csrfRes = await fetch(`${BASE_URL}/csrf_token.php`, { credentials: 'include' });
        const csrfData = await csrfRes.json();
        const res = await fetch(`${BASE_URL}/reviews.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_id: productId, rating: _selectedRating, comment, csrf_token: csrfData.csrf_token }),
            credentials: 'include'
        });
        if (res.status === 401) { alert('Please log in to submit a review.'); window.location.href = 'login.html'; return; }
        const data = await res.json();
        if (data.success) {
            alert('Review submitted!');
            document.getElementById('review-modal-overlay').remove();
            loadProducts();
        } else { alert(data.message); }
    } catch(e) { alert('Failed to submit review.'); }
}

function escapeHTML(str) {
    if (!str) return '';
    var m = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
    return str.replace(/[&<>'"]/g, function(c) { return m[c]; });
}
