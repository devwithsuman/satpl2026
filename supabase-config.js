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
 * Helper: Automatically retries a fetch/supabase call if it fails due to network (DNS/CORS)
 * Optimized for GitHub Pages where PHP/Proxy is not possible.
 */
window.safeSupabaseCall = async function (callFn, maxRetries = 3, metadata = {}) {
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
                const waitTime = (i + 1) * 1000;
                console.warn(`⚠️ Connection attempt ${i + 1} failed (${err.message || err}). Retrying in ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
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
        // Raw probe to see if server is reached
        await fetch(probeUrl, { mode: 'no-cors', method: 'GET' });
        dnsPass = true;
    } catch (e) { }

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
    const msg = (error.message || "").toLowerCase();
    const isFetchError = msg.includes('fetch') || msg.includes('load failed') || msg.includes('networkerror');

    if (isFetchError) {
        if (dnsPass) {
            diagnosticMsg += "CORS Blocked. \n\nTroubleshooting:\n1. Your DNS is working, but project settings need update.\n2. Ensure 'Allowed Origins' in Supabase Dashboard includes your domain.";
        } else {
            diagnosticMsg += "ISP/DNS Blocked. \n\nTroubleshooting:\n1. Your Mobile ISP is blocking connection.\n2. Try changing DNS to Google (8.8.8.8).\n3. Use a different SIM card or WiFi.";
        }
    } else {
        diagnosticMsg += error.message;
    }

    return { success: false, error: error.message, detailed: diagnosticMsg };
};

// Helper: Check if an error is network/ISP related
window.isNetworkError = function (err) {
    if (!err) return false;
    const msg = (err.message || String(err)).toLowerCase();
    return msg.includes('fetch') || msg.includes('load failed') || msg.includes('networkerror') || msg.includes('dns');
};

// Start connection warmup
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
