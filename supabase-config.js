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

    // Silent logging for network errors instead of intrusive alerts
    if (window.isNetworkError(error)) {
        console.warn("💡 TIP: If you are on Jio/Airtel and seeing failures, changing phone DNS to 8.8.8.8 often fixes this permanently.");
    }

    return { success: false, error: error.message };
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
