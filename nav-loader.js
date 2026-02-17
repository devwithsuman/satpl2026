async function loadNavbar() {
    const navContainers = document.querySelectorAll('#dynamic-navbar');
    if (navContainers.length === 0) return;

    try {
        const { data, error } = await supabaseClient
            .from('nav_menu')
            .select('*')
            .eq('is_active', true)
            .order('order_index', { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
            const currentPath = window.location.pathname.split('/').pop() || 'index.html';
            const navHtml = data.map(item => {
                let classes = 'btn-secondary';
                if (item.link === 'registration.html') classes = 'btn btn-red-blink';
                if (currentPath === item.link || (currentPath === '' && item.link === 'index.html')) classes += ' active-nav';

                return `
                    <a href="${item.link}" class="${classes}">
                        ${item.label}
                    </a>
                `;
            }).join('');

            navContainers.forEach(container => container.innerHTML = navHtml);
        } else {
            // Static Fallback
            const navHtml = `
                <a href="index.html" class="btn-secondary">Home</a>
                <a href="squads.html" class="btn-secondary">Squads</a>
                <a href="registration.html" class="btn btn-red-blink">Register Now</a>
            `;
            navContainers.forEach(container => container.innerHTML = navHtml);
        }
    } catch (err) {
        console.warn("Navbar loading failed, using fallback:", err);
        const navHtml = `
            <a href="index.html" class="btn-secondary">Home</a>
            <a href="squads.html" class="btn-secondary">Squads</a>
            <a href="registration.html" class="btn btn-red-blink">Register Now</a>
        `;
        navContainers.forEach(container => container.innerHTML = navHtml);
    }
}

// Auto-init on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNavbar);
} else {
    loadNavbar();
}
