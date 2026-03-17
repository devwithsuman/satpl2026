let _navbarLoaded = false;

// --- Global Toast Notification System ---
window.showToast = function (message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = '🔔';
    if (type === 'success') { icon = '✅'; toast.style.borderLeftColor = 'var(--secondary)'; }
    if (type === 'error') { icon = '❌'; toast.style.borderLeftColor = 'var(--primary)'; }
    if (type === 'info') { icon = 'ℹ️'; toast.style.borderLeftColor = '#3b82f6'; }
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 500); }, 4000);
};

document.addEventListener('DOMContentLoaded', () => {
    const preloader = document.getElementById('preloader');
    if (preloader) {
        setTimeout(() => {
            preloader.classList.add('fade-out');
            document.body.classList.remove('preloader-active');
            setTimeout(() => preloader.remove(), 1000);
        }, 300);
    }
    const progressBar = document.createElement('div');
    progressBar.id = 'page-progress-bar';
    document.body.appendChild(progressBar);
    setTimeout(() => {
        progressBar.style.width = '100%';
        setTimeout(() => { progressBar.style.opacity = '0'; setTimeout(() => progressBar.remove(), 500); }, 500);
    }, 100);

    injectHamburgerCSS();
    createHamburgerOverlay(); // Create the slide-in panel once, in body
});

// ─────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────
function injectHamburgerCSS() {
    if (document.getElementById('ham-nav-css')) return;
    const s = document.createElement('style');
    s.id = 'ham-nav-css';
    s.textContent = `
        /* ── Hamburger Button (in navbar) ── */
        #ham-btn {
            display: none;
            align-items: center;
            justify-content: center;
            width: 44px;
            height: 44px;
            background: rgba(255,255,255,0.07);
            border: 1.5px solid rgba(255,255,255,0.15);
            border-radius: 12px;
            color: white;
            font-size: 1.35rem;
            cursor: pointer;
            transition: all .3s ease;
            flex-shrink: 0;
        }
        #ham-btn:hover  { background: rgba(0,242,255,.15); border-color: var(--secondary); }
        #ham-btn.is-open{ background: var(--secondary); border-color: var(--secondary); color: #050816; }

        /* ── Full-screen overlay ── */
        #ham-overlay {
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: none;
            pointer-events: none;
        }
        #ham-overlay.open { display: block; pointer-events: all; }

        /* Backdrop */
        #ham-backdrop {
            position: absolute;
            inset: 0;
            background: rgba(0,0,0,.65);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            opacity: 0;
            transition: opacity .35s ease;
        }
        #ham-overlay.open #ham-backdrop { opacity: 1; }

        /* Side panel */
        #ham-panel {
            position: absolute;
            top: 0; right: 0;
            width: 280px;
            max-width: 85vw;
            height: 100%;
            background: linear-gradient(170deg,#0d1230 0%,#050816 100%);
            border-left: 1.5px solid rgba(0,242,255,.15);
            box-shadow: -20px 0 60px rgba(0,0,0,.6);
            padding: 0;
            display: flex;
            flex-direction: column;
            transform: translateX(110%);
            transition: transform .38s cubic-bezier(.4,0,.2,1);
            overflow: hidden;
        }
        #ham-overlay.open #ham-panel { transform: translateX(0); }

        /* Panel header */
        #ham-panel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 22px 22px 18px;
            border-bottom: 1px solid rgba(255,255,255,.07);
            background: rgba(0,242,255,.04);
        }
        #ham-panel-logo {
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 900;
            font-size: 1.05rem;
            letter-spacing: .5px;
            background: linear-gradient(135deg,var(--primary),var(--secondary));
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        #ham-close-btn {
            width: 36px; height: 36px;
            border-radius: 50%;
            background: rgba(255,255,255,.07);
            border: 1px solid rgba(255,255,255,.12);
            color: white;
            font-size: 1.1rem;
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: all .25s ease;
            flex-shrink: 0;
        }
        #ham-close-btn:hover { background: var(--primary); border-color: var(--primary); transform: rotate(90deg); }

        /* Menu body */
        #ham-menu-body {
            flex: 1;
            overflow-y: auto;
            padding: 20px 16px 30px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        #ham-menu-body::-webkit-scrollbar { width: 4px; }
        #ham-menu-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 4px; }

        /* Section label */
        .ham-section-label {
            font-size: 0.68rem;
            color: rgba(160,160,192,.6);
            text-transform: uppercase;
            letter-spacing: 2.5px;
            font-weight: 700;
            padding: 12px 6px 4px;
        }

        /* Menu links */
        .ham-menu-link {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 15px 18px;
            border-radius: 14px;
            color: rgba(255,255,255,.85);
            text-decoration: none;
            font-weight: 600;
            font-size: 1rem;
            border: 1.5px solid transparent;
            background: rgba(255,255,255,.04);
            transition: all .22s ease;
            position: relative;
            overflow: hidden;
        }
        .ham-menu-link::before {
            content: '';
            position: absolute;
            left: 0; top: 0; bottom: 0;
            width: 3px;
            background: var(--secondary);
            border-radius: 0 3px 3px 0;
            opacity: 0;
            transition: opacity .2s;
        }
        .ham-menu-link:hover,
        .ham-menu-link:focus {
            background: rgba(0,242,255,.1);
            border-color: rgba(0,242,255,.3);
            color: var(--secondary);
            transform: translateX(6px);
        }
        .ham-menu-link:hover::before { opacity: 1; }
        .ham-menu-link.active-nav {
            background: rgba(0,242,255,.12);
            border-color: rgba(0,242,255,.4);
            color: var(--secondary);
        }
        .ham-menu-link.active-nav::before { opacity: 1; }
        .ham-menu-icon {
            font-size: 1.3rem;
            width: 34px; height: 34px;
            border-radius: 10px;
            display: flex; align-items: center; justify-content: center;
            background: rgba(255,255,255,.06);
            flex-shrink: 0;
        }
        .ham-menu-link:hover .ham-menu-icon { background: rgba(0,242,255,.15); }
        .ham-menu-link-text { flex: 1; }

        /* Panel footer */
        #ham-panel-footer {
            padding: 16px 20px 20px;
            border-top: 1px solid rgba(255,255,255,.06);
            font-size: 0.72rem;
            color: rgba(160,160,192,.5);
            text-align: center;
        }

        /* Mobile: show hamburger, hide extra links */
        @media (max-width: 768px) {
            #ham-btn { display: flex !important; }
            .nav-hidden-mobile { display: none !important; }
            .navbar .container {
                flex-wrap: nowrap !important;
                justify-content: space-between !important;
                align-items: center !important;
                gap: 0 !important;
            }
            #dynamic-navbar {
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
                flex-shrink: 0 !important;
            }
            #dynamic-navbar a:not(.nav-hidden-mobile) {
                padding: 8px 12px !important;
                font-size: 0.8rem !important;
                white-space: nowrap !important;
            }
        }
    `;
    document.head.appendChild(s);
}

// ─────────────────────────────────────────────
// Create overlay panel — appended to <body> once
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// Create overlay panel — appended to <body> once
// ─────────────────────────────────────────────
function createHamburgerOverlay() {
    if (document.getElementById('ham-overlay')) return;

    const currentPath = window.location.pathname.split('/').pop() || 'index.html';

    // Default fallback hamburger items (used before DB loads)
    const defaultMobileItems = [
        { icon: '🏠', label: 'Home', link: 'index.html' },
        { icon: '📺', label: 'Scorecard', link: 'scorecard.html' },
        { icon: '⚙️', label: 'Admin Panel', link: 'admin-login.html' },
        { icon: '🏏', label: 'Player Details', link: 'players.html' },
        { icon: '🛡️', label: 'Squads', link: 'squads.html' },
        { icon: '📅', label: 'Fixtures', link: 'fixtures.html' },
    ];

    const iconMap = {
        'index.html': '🏠', 'scorecard.html': '📺', 'admin-login.html': '⚙️',
        'players.html': '🏏', 'squads.html': '🛡️', 'fixtures.html': '📅',
        'registration.html': '🏷️', 'auction.html': '🔴',
    };

    const buildLinksHtml = (items) => items.map(item => {
        const icon = item.icon || iconMap[item.link] || '📌';
        const active = currentPath === item.link ? 'active-nav' : '';
        return `
        <a href="${item.link}" class="ham-menu-link ${active}">
            <span class="ham-menu-icon">${icon}</span>
            <span class="ham-menu-link-text">${item.label}</span>
        </a>`;
    }).join('');

    const overlay = document.createElement('div');
    overlay.id = 'ham-overlay';
    overlay.innerHTML = `
        <div id="ham-backdrop"></div>
        <div id="ham-panel">
            <div id="ham-panel-header">
                <div id="ham-panel-logo">
                    <span>⚡</span>
                    <span>SATPL 2026</span>
                </div>
                <button id="ham-close-btn" aria-label="Close menu">✕</button>
            </div>
            <div id="ham-menu-body">
                <div class="ham-section-label">Navigation</div>
                <div id="ham-dynamic-links">
                    ${buildLinksHtml(defaultMobileItems)}
                </div>
            </div>
            <div id="ham-panel-footer">Sonaijuri Anchal Tennis Premier League</div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Wire up events
    const openFn = () => { overlay.classList.add('open'); document.body.style.overflow = 'hidden'; };
    const closeFn = () => { overlay.classList.remove('open'); document.body.style.overflow = ''; };

    document.getElementById('ham-backdrop').addEventListener('click', closeFn);
    document.getElementById('ham-close-btn').addEventListener('click', closeFn);
    overlay.addEventListener('click', (e) => {
        if (e.target.closest('.ham-menu-link')) closeFn();
    });

    // Expose open function
    window._openHamburger = openFn;

    // Load from DB if available
    if (typeof supabaseClient !== 'undefined') {
        loadMobileMenuFromDB(currentPath, iconMap, buildLinksHtml);
    }
}

async function loadMobileMenuFromDB(currentPath, iconMap, buildLinksHtml) {
    try {
        const { data, error } = await window.safeSupabaseCall(() =>
            supabaseClient.from('mobile_menu').select('*').eq('is_active', true).order('order_index', { ascending: true })
        );
        if (!error && data && data.length > 0) {
            const container = document.getElementById('ham-dynamic-links');
            if (container) container.innerHTML = buildLinksHtml(data);
        }
    } catch (err) {
        console.warn('Mobile menu DB fetch failed:', err);
    }
}

// ─────────────────────────────────────────────
// Navbar loader
// ─────────────────────────────────────────────
async function loadNavbar() {
    if (_navbarLoaded) return;
    _navbarLoaded = true;

    const navContainers = document.querySelectorAll('#dynamic-navbar');
    if (navContainers.length === 0) return;

    const currentPath = window.location.pathname.split('/').pop() || 'index.html';

    const fallbackItems = [
        { label: 'Home', link: 'index.html' },
        { label: 'Players', link: 'players.html' },
        { label: '🔴 Live Auction', link: 'auction.html' },
        { label: 'Scoreboard', link: 'scorecard.html' },
        { label: 'Squads', link: 'squads.html' },
        { label: 'Fixtures', link: 'fixtures.html' },
        { label: 'Register Now', link: 'registration.html', isRegister: true },
    ];

    renderNavbar(navContainers, fallbackItems, currentPath);

    if (typeof supabaseClient === 'undefined') return;
    try {
        const { data, error } = await window.safeSupabaseCall(() =>
            supabaseClient.from('nav_menu').select('*').eq('is_active', true).order('order_index', { ascending: true })
        );
        if (!error && data && data.length > 0) {
            renderNavbar(navContainers, data, currentPath);
        }
    } catch (err) {
        console.warn('Navbar DB fetch failed:', err.message);
    }
}

// Links always visible on mobile (not hidden)
const PINNED_MOBILE = ['index.html', 'scorecard.html', ''];

function renderNavbar(containers, items, currentPath) {
    containers.forEach(container => {
        const linksHtml = items.map(item => {
            let classes = (item.isRegister || item.link === 'registration.html')
                ? 'btn btn-red-blink' : 'btn-secondary';
            if (item.label.toLowerCase().includes('auction') || item.link === 'auction.html') {
                classes = 'btn btn-live-auction';
                if (!item.label.includes('🔴')) item.label = '🔴 ' + item.label;
            }
            const isActive = currentPath === item.link || (currentPath === '' && item.link === 'index.html');
            if (isActive) classes += ' active-nav';

            const isPinned = PINNED_MOBILE.includes(item.link);
            if (!isPinned) classes += ' nav-hidden-mobile';

            return `<a href="${item.link}" class="${classes}">${item.label}</a>`;
        }).join('');

        // Hamburger trigger button — just the ☰, styled cleanly
        const hamBtn = `<button id="ham-btn" aria-label="Open menu" onclick="window._openHamburger && window._openHamburger()">☰</button>`;

        container.innerHTML = linksHtml + hamBtn;
    });
}

// ─────────────────────────────────────────────
// Developer Credits
// ─────────────────────────────────────────────
async function loadDevCredits() {
    const container = document.getElementById('dev-credits-container');
    if (!container || typeof supabaseClient === 'undefined') return;
    try {
        const { data, error } = await window.safeSupabaseCall(() =>
            supabaseClient.from('site_settings').select('*').eq('id', 'global-settings').single()
        );
        if (error || !data || !data.dev_name) { container.style.display = 'none'; return; }
        container.innerHTML = `
            <div class="dev-credits">
                <span class="dev-label">Developed ❤️ by</span>
                <span class="dev-name">${data.dev_name}</span>
                <div class="dev-socials">
                    ${data.dev_insta ? `<a href="https://instagram.com/${data.dev_insta}" target="_blank" class="dev-icon"><img src="https://cdn-icons-png.flaticon.com/512/174/174855.png" alt="Insta"></a>` : ''}
                    ${data.dev_web ? `<a href="${data.dev_web}" target="_blank" class="dev-icon"><img src="https://img.icons8.com/?size=100&id=BXD00LqXXzlc&format=png&color=000000" alt="Web"></a>` : ''}
                    ${data.dev_whatsapp ? `<a href="https://wa.me/${data.dev_whatsapp}" target="_blank" class="dev-icon"><img src="https://cdn-icons-png.flaticon.com/512/733/733585.png" alt="WA"></a>` : ''}
                </div>
            </div>`;
    } catch (err) { console.warn('Dev Credits failed:', err); }
}

// Auto-init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { loadNavbar(); loadDevCredits(); });
} else {
    loadNavbar();
    loadDevCredits();
}
