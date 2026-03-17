/**
 * SATPL 2026 - News Ticker Logic
 * Fetches real-time auction updates and announcements.
 */

async function initTicker() {
    const track = document.getElementById('notice-list');
    if (!track) return;

    // Default static messages if DB fails
    const staticNews = [
        "🚀 SATPL 2026 Auction is Now Live!",
        "🔥 Record breaking bids expected this season!",
        "🏆 Sonaijuri Anchal Tennis Premier League - Season 2026",
        "📢 Registration portal is open for all regional players."
    ];

    try {
        if (!window.supabaseClient) {
            console.warn("Ticker: Supabase not ready, using static news.");
            renderTicker(staticNews);
            return;
        }

        // Fetch latest sales for the ticker
        const { data: sales, error } = await window.supabaseClient
            .from('team_players')
            .select('player_name, team_name, auction_price')
            .order('created_at', { ascending: false })
            .limit(5);

        let newsItems = [...staticNews];
        if (sales && sales.length > 0) {
            const saleNews = sales.map(s =>
                `🔥 SOLD: ${s.player_name} to ${s.team_name} for ₹${s.auction_price.toLocaleString()}!`
            );
            newsItems = [...saleNews, ...staticNews];
        }

        renderTicker(newsItems);

    } catch (e) {
        console.error("Ticker failed:", e);
        renderTicker(staticNews);
    }
}

function renderTicker(items) {
    const track = document.getElementById('notice-list');
    if (!track) return;

    // Duplicate list for infinite scroll feel
    const content = items.map(item => {
        let prefix = "📢";
        if (item.includes("SOLD")) prefix = '<span class="pulsing-red-dot">●</span> <span style="color: #ff0055; font-weight: 800;">SOLD</span>';
        if (item.includes("Live")) prefix = '<span class="pulsing-cyan-dot">●</span> <span style="color: #00f2ff; font-weight: 800;">LIVE</span>';

        return `<div class="ticker-item">${prefix} ${item}</div>`;
    }).join('');
    track.innerHTML = content + content;
}

// Re-fetch on updates if needed
window.addEventListener('DOMContentLoaded', initTicker);
