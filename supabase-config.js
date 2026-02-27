// ===== SUPABASE CONFIG =====
var SUPABASE_URL = "https://lsikcaybolgsfimwtkdv.supabase.co";
// Using legacy JWT key (still valid) — new sb_publishable_ format caused fetch failures
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
 * Helper: Automatically retries a fetch/supabase call if it fails due to network (DNS/CORS)
 */
window.safeSupabaseCall = async function (callFn, maxRetries = 2) {
    let lastError;
    for (let i = 0; i <= maxRetries; i++) {
        try {
            const { data, error } = await callFn();
            if (error && error.message === 'Failed to fetch') {
                throw error;
            }
            return { data, error };
        } catch (err) {
            lastError = err;
            if (err.message === 'Failed to fetch' && i < maxRetries) {
                console.warn(`⚠️ Connection attempt ${i + 1} failed. Retrying in 1s...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }
            break;
        }
    }
    return { data: null, error: lastError };
};

window.testSupabaseConnection = async function () {
    console.log("🔍 Probing Supabase Connectivity...");
    const probeUrl = `${SUPABASE_URL}/rest/v1/site_settings?select=id&limit=1`;

    let dnsPass = false;
    try {
        // Step 1: Raw DNS/Network probe (ignores CORS)
        await fetch(probeUrl, { mode: 'no-cors', method: 'GET' });
        dnsPass = true;
        console.log("📡 DNS/Network Probe: OK (Server reached)");
    } catch (e) {
        console.warn("📡 DNS/Network Probe: FAILED (Server unreachable)");
    }

    const start = Date.now();
    const probe = () => window.supabaseClient.from('site_settings').select('id').limit(1);
    const { error } = await window.safeSupabaseCall(probe, 2);
    const duration = Date.now() - start;

    if (!error) {
        console.log(`✅ Supabase Connection Healthy (${duration}ms)`);
        return { success: true, duration };
    }

    console.error("❌ Supabase Connection Failed:", error.message);

    let diagnosticMsg = "Supabase Connection Error: ";
    if (error.message === 'Failed to fetch') {
        if (dnsPass) {
            diagnosticMsg += "CORS Blocked. \n\nTroubleshooting:\n1. Your DNS is working fine, but Supabase is rejecting the request.\n2. Go to Supabase Dashboard -> Authentication -> URL Configuration.\n3. Add 'https://inkvibe.in' and 'https://devwithsuman.in' to 'Allowed Origins'.\n4. Make sure you use HTTPS and not HTTP.";
        } else {
            diagnosticMsg += "Network/DNS Blocked. \n\nTroubleshooting:\n1. Your mobile network cannot find the Supabase server.\n2. Try changing your DNS (Google: 8.8.8.8 or Cloudflare: 1.1.1.1).\n3. Try switching to a different SIM card or WiFi.\n4. Ensure you don't have an Ad-blocker active.";
        }
    } else {
        diagnosticMsg += error.message;
    }

    return { success: false, error: error.message, detailed: diagnosticMsg };
};

// Auto-check on load (silent for users, helpful for dev console)
testSupabaseConnection().then(res => {
    if (!res.success && !isAdminPage) {
        console.warn("⚠️ Initial connection check failed. Users might see errors.");
    }
});

// Helper: Ensure external links have a protocol
window.ensureAbsoluteUrl = function (url) {
    if (!url) return "";
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('mailto:') || trimmed.startsWith('tel:') || trimmed.startsWith('#')) {
        return trimmed;
    }
    // If it contains a dot and doesn't look like a local file, assume it's a domain
    if (trimmed.includes('.') && !trimmed.startsWith('/') && !trimmed.endsWith('.html')) {
        return 'https://' + trimmed;
    }
    return trimmed;
};
