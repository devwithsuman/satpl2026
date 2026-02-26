let _navbarLoaded = false; // Guard against double-loading

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

    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    // Animation trigger
    setTimeout(() => toast.classList.add('show'), 100);

    // Auto remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
};

// Override standard alerts (Optional - safer if you do it manually)
// window.alert = (msg) => showToast(msg, 'info');

document.addEventListener('DOMContentLoaded', () => {
    // --- Preloader Removal Logic ---
    const preloader = document.getElementById('preloader');
    if (preloader) {
        // Show for at least 1.8 seconds for the premium feel
        setTimeout(() => {
            preloader.classList.add('fade-out');
            document.body.classList.remove('preloader-active');

            // Completely remove from DOM after transition
            setTimeout(() => {
                preloader.remove();
            }, 1000);
        }, 1800);
    }

    // Page load animation effect
    const progressBar = document.createElement('div');
    progressBar.id = 'page-progress-bar';
    document.body.appendChild(progressBar);

    setTimeout(() => {
        progressBar.style.width = '100%';
        setTimeout(() => {
            progressBar.style.opacity = '0';
            setTimeout(() => progressBar.remove(), 500);
        }, 500);
    }, 100);
});

async function loadNavbar() {
    if (_navbarLoaded) return; // Prevent duplicate renders
    _navbarLoaded = true;

    const navContainers = document.querySelectorAll('#dynamic-navbar');
    if (navContainers.length === 0) return;

    const currentPath = window.location.pathname.split('/').pop() || 'index.html';

    const renderItems = (items) => {
        return items.map(item => {
            let classes = (item.isRegister || item.link === 'registration.html') ? 'btn btn-red-blink' : 'btn-secondary';
            if (currentPath === item.link || (currentPath === '' && item.link === 'index.html')) classes += ' active-nav';
            return `<a href="${item.link}" class="${classes}">${item.label}</a>`;
        }).join('');
    };

    // Step 1: Show fallback immediately
    const fallbackItems = [
        { label: 'Home', link: 'index.html' },
        { label: 'Scoreboard', link: 'scorecard.html' },
        { label: 'Squads', link: 'squads.html' },
        { label: 'Fixtures', link: 'fixtures.html' },
        { label: 'Register Now', link: 'registration.html', isRegister: true },
    ];
    navContainers.forEach(container => container.innerHTML = renderItems(fallbackItems));

    // Step 2: Try to load from DB (only if supabaseClient is ready)
    if (typeof supabaseClient === 'undefined') return;

    try {
        const { data, error } = await supabaseClient
            .from('nav_menu')
            .select('*')
            .eq('is_active', true)
            .order('order_index', { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
            navContainers.forEach(container => container.innerHTML = renderItems(data));
            console.log("✅ Navbar loaded from database (" + data.length + " items).");
        } else {
            console.warn("No nav items in DB, using fallback.");
        }
    } catch (err) {
        console.warn("Navbar DB fetch failed, using fallback:", err.message);
    }
}

// --- Developer Credits Loader ---
async function loadDevCredits() {
    const container = document.getElementById('dev-credits-container');
    if (!container || typeof supabaseClient === 'undefined') return;

    try {
        const { data, error } = await supabaseClient
            .from('site_settings')
            .select('*')
            .eq('id', 'global-settings')
            .single();

        if (error || !data || !data.dev_name) {
            container.style.display = 'none';
            return;
        }

        container.innerHTML = `
            <div class="dev-credits">
                <span class="dev-label">Developed ❤️ by</span>
                <span class="dev-name">${data.dev_name}</span>
                <div class="dev-socials">
                    ${data.dev_insta ? `
                        <a href="https://instagram.com/${data.dev_insta}" target="_blank" class="dev-icon" title="Instagram">
                            <img src="https://cdn-icons-png.flaticon.com/512/174/174855.png" alt="Insta">
                        </a>` : ''}
                    ${data.dev_web ? `
                        <a href="${ensureAbsoluteUrl(data.dev_web)}" target="_blank" class="dev-icon" title="Website">
                            <img src="https://img.icons8.com/?size=100&id=BXD00LqXXzlc&format=png&color=000000" alt="Web">
                        </a>` : ''}
                    ${data.dev_whatsapp ? `
                        <a href="https://wa.me/${data.dev_whatsapp}" target="_blank" class="dev-icon" title="WhatsApp">
                            <img src="https://cdn-icons-png.flaticon.com/512/733/733585.png" alt="WA">
                        </a>` : ''}
                </div>
            </div>
        `;
    } catch (err) {
        console.warn("Dev Credits Load Failed:", err);
    }
}

// Auto-init on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        loadNavbar();
        loadDevCredits();
    });
} else {
    loadNavbar();
    loadDevCredits();
}
