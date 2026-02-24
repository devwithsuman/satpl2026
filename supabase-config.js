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
