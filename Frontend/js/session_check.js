// ============================================================
// session_check.js — Global Session & Navigation Manager
// ============================================================

(function() {
    const PUBLIC_PAGES = ['login.html', 'register.html', 'forgot_password.html', 'reset_password.html'];
    
    // Determine how many levels deep we are to reach the root
    const path = window.location.pathname;
    const isSubfolder = path.includes('/admin/') || path.includes('/vendor/') || path.includes('/forgot_password/');
    
    // Root-relative path to Backend (Works for the project alias)
    const BASE_API_URL = (window.location.protocol === 'file:')
        ? 'http://localhost:8080/Backend'
        : (window.location.pathname.includes('/Ecommerce_site/') ? '/Ecommerce_site/Backend' : '/Backend');

    async function verifySession() {
        try {
            const response = await fetch(`${BASE_API_URL}/auth_status.php`, { credentials: 'include' });
            if (!response.ok) return; // Silent fail, let page load
            
            const data = await response.json();
            const currentPage = path.split('/').pop() || 'index.html';

            if (!data.logged_in) {
                if (!PUBLIC_PAGES.includes(currentPage) && currentPage !== 'index.html' && currentPage !== 'product_details.html') {
                   const prefix = isSubfolder ? '../' : '';
                   window.location.href = prefix + 'login.html';
                }
                // Show guest CTA, hide member content
                const guestSection = document.getElementById('guest-cta-section');
                const memberHero = document.getElementById('member-hero');
                if (guestSection) guestSection.style.display = '';
                if (memberHero) memberHero.style.display = 'none';
            } else {
                // Logged in: Don't allow going to login/register
                if (PUBLIC_PAGES.includes(currentPage)) {
                    const prefix = isSubfolder ? '../' : '';
                    window.location.href = prefix + 'index.html';
                    return;
                }
                
                // Role Protection
                if (path.includes('/admin/') && data.role !== 'admin') {
                    window.location.href = '../index.html';
                    return;
                }
                if (path.includes('/vendor/') && data.role !== 'vendor') {
                    window.location.href = '../index.html';
                    return;
                }

                // Show member hero, hide guest CTA
                const guestSection = document.getElementById('guest-cta-section');
                const memberHero = document.getElementById('member-hero');
                if (guestSection) guestSection.style.display = 'none';
                if (memberHero) memberHero.style.display = '';

                // Update User UI
                updateNavigation(data, isSubfolder);
            }
        } catch (error) {
            console.warn("Session check skipped:", error);
        }
    }

    function updateNavigation(data, isSub) {
        const authDiv = document.getElementById('auth-actions');
        if (!authDiv) return;

        const frontendPrefix = window.location.pathname.includes('/Ecommerce_site/') ? '/Ecommerce_site/Frontend/' : '/';
        let roleLink = '';
        if (data.role === 'vendor') {
            roleLink = `<a href="${frontendPrefix}vendor/dashboard.html" style="color:var(--clr-accent); margin-right:1rem; text-decoration:none; font-weight:600;"><i class="ph ph-storefront"></i> Seller Hub</a>`;
        } else if (data.role === 'customer') {
            roleLink = `<a href="${frontendPrefix}vendor_apply.html" style="color:var(--clr-primary-light); margin-right:1rem; text-decoration:none; font-weight:600;"><i class="ph ph-megaphone"></i> Sell</a>`;
        } else if (data.role === 'admin') {
            roleLink = `<a href="${frontendPrefix}admin/dashboard.html" style="color:#d946ef; margin-right:1rem; text-decoration:none; font-weight:600;"><i class="ph ph-shield-check"></i> Admin</a>`;
        }

        // Keep logout on the same backend origin/path used for the session check.
        // This avoids a 404 when the project is hosted outside /Ecommerce_site.
        const backendPrefix = `${BASE_API_URL}/`;

        authDiv.innerHTML = `
            ${roleLink}
            <a href="${frontendPrefix}wishlist.html" style="color:var(--clr-text); margin-right:0.8rem; text-decoration:none; position:relative;">
               <i class="ph ph-heart" style="font-size:1.2rem; vertical-align:middle;"></i>
            </a>
            <a href="${frontendPrefix}profile.html" style="color:var(--clr-text); font-weight:600; margin-right:1rem; display:inline-flex; align-items:center; gap:0.5rem; text-decoration:none;">
               <i class="ph ph-user-circle"></i> ${data.user_name}
            </a>
            <a href="${frontendPrefix}cart.html" style="color:var(--clr-text); margin-right:1rem; text-decoration:none;">
               <i class="ph ph-shopping-cart" style="font-size:1.2rem; vertical-align:middle;"></i> Cart
            </a>
            <a href="${backendPrefix}logout.php" class="btn-ghost" style="padding:0">Logout</a>
        `;
    }

    verifySession();
})();
