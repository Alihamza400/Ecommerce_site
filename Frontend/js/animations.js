// ============================================================
// animations.js — Enterprise Animation Engine
// Scroll-triggered reveals, ripple effects, and interactions
// ============================================================

(function() {
    'use strict';
    console.log('🎬 ShopVerse Animation Engine v1 loaded');

    // ── 1. SCROLL REVEAL — IntersectionObserver ────────────
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                // Stop observing after reveal for performance
                revealObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    function initScrollReveal() {
        document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach(el => {
            revealObserver.observe(el);
        });
    }

    // ── 2. RIPPLE EFFECT ON BUTTONS ────────────────────────
    function initRippleEffect() {
        document.querySelectorAll('.btn-ripple').forEach(btn => {
            btn.addEventListener('click', function(e) {
                const rect = this.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                this.style.setProperty('--ripple-x', x + '%');
                this.style.setProperty('--ripple-y', y + '%');
                // Remove old ripple
                const old = this.querySelector('.ripple-effect');
                if (old) old.remove();
                // Add ripple
                const ripple = document.createElement('span');
                ripple.className = 'ripple-effect';
                ripple.style.cssText = `
                    position: absolute; inset: 0; border-radius: inherit;
                    background: radial-gradient(circle at ${x}% ${y}%, 
                        rgba(255,255,255,0.2), transparent 60%);
                    pointer-events: none;
                    animation: rippleFade 0.6s ease-out forwards;
                `;
                this.appendChild(ripple);
                setTimeout(() => ripple.remove(), 600);
            });
        });
    }

    // ── 3. MAGNETIC BUTTONS ────────────────────────────────
    function initMagneticButtons() {
        document.querySelectorAll('.magnetic-btn').forEach(btn => {
            btn.addEventListener('mousemove', function(e) {
                const rect = this.getBoundingClientRect();
                const x = (e.clientX - rect.left - rect.width / 2) / 20;
                const y = (e.clientY - rect.top - rect.height / 2) / 20;
                this.style.transform = `translate(${x}px, ${y}px)`;
            });
            btn.addEventListener('mouseleave', function() {
                this.style.transform = '';
            });
        });
    }

    // ── 4. ACETERNITY 3D PIN CARD TILT ────────────────────
    window.initPinCardTilt = function() {
        document.querySelectorAll('[data-tilt]').forEach(card => {
            const container = card.closest('.pin-card-container');
            card.addEventListener('mousemove', function(e) {
                const rect = this.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width - 0.5;
                const y = (e.clientY - rect.top) / rect.height - 0.5;
                // Subtle 3D tilt
                this.style.transform = 
                    `perspective(800px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg)`;
                // Move glow towards cursor
                const glow = this.querySelector('.pin-card-glow');
                if (glow) {
                    const px = ((e.clientX - rect.left) / rect.width) * 100;
                    const py = ((e.clientY - rect.top) / rect.height) * 100;
                    glow.style.left = px + '%';
                    glow.style.top = py + '%';
                }
            });
            card.addEventListener('mouseleave', function() {
                this.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg)';
            });
        });
    }

    // ── 5. SMOOTH COUNTER ANIMATION ────────────────────────
    window.animateCounter = function(el, target, duration = 1500) {
        if (!el) return;
        const start = parseInt(el.textContent) || 0;
        const diff = target - start;
        const startTime = performance.now();
        
        function tick(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.floor(start + diff * eased);
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    };

    // ── 6. PARALLAX ON SCROLL ──────────────────────────────
    function initParallaxScroll() {
        document.querySelectorAll('.parallax').forEach(el => {
            window.addEventListener('scroll', () => {
                const rect = el.getBoundingClientRect();
                const speed = parseFloat(el.dataset.speed || '0.5');
                const y = (rect.top * speed) / 10;
                el.style.transform = `translateY(${y}px)`;
            }, { passive: true });
        });
    }

    // ── 7. ADD TO CART FEEDBACK ────────────────────────────
    window.showAddToCartFeedback = function(btn) {
        if (!btn) return;
        const original = btn.innerHTML;
        btn.innerHTML = '<i class="ph ph-check-circle"></i>';
        btn.style.background = 'var(--clr-success)';
        setTimeout(() => {
            btn.innerHTML = original;
            btn.style.background = '';
        }, 1500);
    };

    // ── INIT ALL ───────────────────────────────────────────
    function init() {
        initScrollReveal();
        initRippleEffect();
        initMagneticButtons();
        window.initPinCardTilt();
        initParallaxScroll();

        // Re-init after dynamic content loads
        const observer = new MutationObserver(() => {
            initScrollReveal();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

// Add keyframe for ripple effect
const style = document.createElement('style');
style.textContent = `
    @keyframes rippleFade {
        to { opacity: 0; transform: scale(2); }
    }
`;
document.head.appendChild(style);
