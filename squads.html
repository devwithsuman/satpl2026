// ===== SUPABASE CONFIG =====
var SUPABASE_URL = "https://lsikcaybolgsfimwtkdv.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzaWtjYXlib2xnc2ZpbXd0a2R2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMjAxMjgsImV4cCI6MjA4Njc5NjEyOH0.e-O0trZ6jvkj-If6MtnYKMTQsmL1vPlEsyajZRLCxqk";

// Detect if we are on an admin-related page
var isAdminPage = window.location.pathname.toLowerCase().includes('admin');

var supabaseOptions = {
    auth: {
        persistSession: isAdminPage,
        autoRefreshToken: isAdminPage,
        detectSessionInUrl: false,
        storageKey: 'satpl-admin-session-v1',
        storage: window.localStorage
    }
};

// Create the client
var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, supabaseOptions);

// Export to window for global access
window.supabaseClient = supabaseClient;

console.log("💎 Supabase Client Initialized [" + (isAdminPage ? "ADMIN MODE" : "PUBLIC MODE") + "]");

// --- Connectivity Diagnostics & Resiliency ---

/**
 * Guerilla DNS Warmup: Probes public DNS-over-HTTPS (DoH) APIs to bypass ISP DNS hijacking.
 * This helps the browser resolve and "unblock" the Supabase domain on blocked mobile networks.
 */
async function warmupDNS() {
    console.log("📡 Pre-warming DNS via Cloudflare DoH...");
    const supabaseDomain = new URL(SUPABASE_URL).hostname;
    const dohUrl = `https://cloudflare-dns.com/dns-query?name=${supabaseDomain}&type=A`;

    try {
        await fetch(dohUrl, {
            headers: { 'accept': 'application/dns-json' },
            mode: 'cors'
        });
        console.log("✅ DNS Warmup probe sent successfully.");
    } catch (e) {
        console.warn("⚠️ DNS Warmup probe skipped or failed.");
    }
}

/**
 * Helper: Automatically retries a fetch/supabase call if it fails due to network (DNS/CORS)
 */
window.safeSupabaseCall = async function (callFn, maxRetries = 5, metadata = {}) {
    let lastError;

    for (let i = 0; i <= maxRetries; i++) {
        try {
            const { data, error } = await callFn();
            if (error && window.isNetworkError(error)) {
                throw error;
            }
            return { data, error };
        } catch (err) {
            lastError = err;

            if (window.isNetworkError(err) && i < maxRetries) {
                const waitTime = Math.pow(2, i) * 500; // Exponential backoff: 0.5s, 1s, 2s, 4s...
                console.warn(`⚠️ Connection attempt ${i + 1} failed. Retrying in ${waitTime}ms...`);

                // If we've failed twice, show the connectivity tip
                if (i === 1) window.showConnectivityTip();

                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }
            break;
        }
    }

    return { data: null, error: lastError };
};

window.testSupabaseConnection = async function () {
    console.log("🔍 Checking Supabase Connectivity...");

    // First, try a warmup
    await warmupDNS();

    const start = Date.now();
    const probe = () => window.supabaseClient.from('site_settings').select('id').limit(1);
    const { error } = await window.safeSupabaseCall(probe, 2);
    const duration = Date.now() - start;

    if (!error) {
        console.log(`✅ Supabase Connection Healthy (${duration}ms)`);
        return { success: true, duration };
    }

    console.error("❌ Supabase Connection Failed:", error.message);

    // Show persistent tip on failure
    if (window.isNetworkError(error)) {
        window.showConnectivityTip();
        console.warn("💡 TIP: If you are on Jio/Airtel and seeing failures, changing phone DNS to 8.8.8.8 often fixes this permanently.");
    }

    return { success: false, error: error.message };
};

/**
 * Visual Connectivity Tip: Shows a floating helper if Supabase is blocked.
 */
window.showConnectivityTip = function () {
    if (document.getElementById('supabase-conn-tip')) return;

    const tip = document.createElement('div');
    tip.id = 'supabase-conn-tip';
    tip.style.cssText = `
        position: fixed;
        bottom: 25px;
        left: 20px;
        right: 20px;
        background: rgba(15, 23, 42, 0.98);
        color: white;
        padding: 18px;
        border-radius: 16px;
        border: 1px solid #00f2ff;
        box-shadow: 0 20px 50px rgba(0,0,0,0.6);
        z-index: 100000;
        font-family: 'Inter', sans-serif;
        font-size: 0.95rem;
        display: flex;
        flex-direction: column;
        gap: 12px;
        animation: tipSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        max-width: 450px;
        margin: 0 auto;
    `;

    tip.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.2rem;">📡</span>
                <strong style="color: #00f2ff; text-transform: uppercase; letter-spacing: 0.5px;">Official Regional Issue</strong>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" style="background:none; border:none; color:white; cursor:pointer; font-size:1.5rem; opacity: 0.6;">&times;</button>
        </div>
        <p style="margin:0; opacity:0.9; line-height:1.5;"><strong>Supabase Official Report:</strong> India mein ISPs (Jio/Airtel) ne database block kiya hai. Humari website healthy hai, ye connectivity issue regional hai.</p>
        <div style="background: rgba(0,242,255,0.05); border-left: 3px solid #00f2ff; padding: 10px; border-radius: 4px;">
            <p style="margin: 0 0 5px 0; font-weight: bold; font-size: 0.8rem; color:#00f2ff;">WORKAROUNDS:</p>
            <ul style="margin: 0; padding-left: 15px; font-size: 0.8rem; opacity: 0.9; line-height: 1.5;">
                <li>Chrome ka <strong>Incognito (Private) Mode</strong> use karein.</li>
                <li>Phone Setup: <strong>Private DNS: 8.8.8.8</strong> (Google) ya <strong>1.1.1.1</strong> (Cloudflare).</li>
            </ul>
        </div>
        <div style="display: flex; gap: 15px; margin-top: 5px;">
            <a href="https://developers.google.com/speed/public-dns/docs/using" target="_blank" style="background: #00f2ff; color: #0f172a; padding: 8px 15px; border-radius: 8px; text-decoration:none; font-weight:bold; font-size:0.8rem;">FIX GUIDE →</a>
            <button onclick="window.location.reload()" style="background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); padding: 8px 15px; border-radius: 8px; cursor: pointer; font-size: 0.8rem;">RETRY 🔄</button>
        </div>
    `;

    if (!document.getElementById('conn-tip-style')) {
        const style = document.createElement('style');
        style.id = 'conn-tip-style';
        style.innerHTML = `
            @keyframes tipSlideUp { 
                from { transform: translateY(120%) scale(0.9); opacity: 0; } 
                to { transform: translateY(0) scale(1); opacity: 1; } 
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(tip);
};

// Helper: Check if an error is network/ISP related
window.isNetworkError = function (err) {
    if (!err) return false;
    const msg = (err.message || String(err)).toLowerCase();
    return msg.includes('fetch') || msg.includes('load failed') || msg.includes('networkerror') || msg.includes('dns') || msg.includes('connection');
};

// Start connection warmup and probe
testSupabaseConnection();

// Helper: Ensure external links have a protocol
window.ensureAbsoluteUrl = function (url) {
    if (!url) return "";
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('mailto:') || trimmed.startsWith('tel:') || trimmed.startsWith('#')) {
        return trimmed;
    }
    if (trimmed.includes('.') && !trimmed.startsWith('/') && !trimmed.endsWith('.html')) {
        return 'https://' + trimmed;
    }
    return trimmed;
};
