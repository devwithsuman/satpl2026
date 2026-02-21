// ===== SUPABASE CONFIG =====
const SUPABASE_URL = "https://lsikcaybolgsfimwtkdv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzaWtjYXlib2xnc2ZpbXd0a2R2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMjAxMjgsImV4cCI6MjA4Njc5NjEyOH0.e-O0trZ6jvkj-If6MtnYKMTQsmL1vPlEsyajZRLCxqk";

// Create the client using the library found at window.supabase
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export to window for global access (Ensures other scripts can see it)
window.supabaseClient = supabaseClient;

console.log("💎 Supabase Client Initialized Successfully!");
