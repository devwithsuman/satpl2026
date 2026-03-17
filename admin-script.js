// ================= AUTH CHECK & SESSION MANAGEMENT =================
let lastActivityTime = Date.now();
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = "admin-login.html";
    }
}

function updateActivity() {
    lastActivityTime = Date.now();
}

// Track activity
['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, updateActivity, true);
});

// Check for inactivity every minute
setInterval(async () => {
    if (Date.now() - lastActivityTime > INACTIVITY_TIMEOUT) {
        console.log("Session timed out due to inactivity.");
        await logout();
    }
}, 60000); // Check every 60 seconds

async function logout() {
    await supabaseClient.auth.signOut();
    window.location.href = "admin-login.html";
}

// ================= NAVIGATION =================
function showSection(sectionId) {
    // Update Sidebar Buttons
    document.querySelectorAll(".sidebar button").forEach(btn => {
        btn.classList.remove("active");
        if (btn.getAttribute('onclick')?.includes(`'${sectionId}'`)) {
            btn.classList.add("active");
        }
    });

    // Update Sections
    document.querySelectorAll(".admin-section").forEach(sec => {
        sec.classList.remove("active");
    });

    const target = document.getElementById(sectionId + "-section");
    if (target) {
        target.classList.add("active");
        if (sectionId === 'dashboard') loadDashboard();
        if (sectionId === 'registrations') fetchRegistrations();
        if (sectionId === 'announcements') fetchNotices();
        if (sectionId === 'fixtures') fetchFixtures();
        if (sectionId === 'leaderboard') fetchLeaderboard();
        if (sectionId === 'teams') fetchAdminTeams();
        if (sectionId === 'points') fetchAdminPoints();
        if (sectionId === 'scoring') { loadScoringSection(); fetchPaidPlayersForAutocomplete(); }
        if (sectionId === 'auction-results') fetchAuctionResults();
        if (sectionId === 'gallery') fetchGallery();
        if (sectionId === 'menu') fetchAdminMenu();
        if (sectionId === 'results') fetchResults();
        if (sectionId === 'auction') initAdminAuction();
        if (sectionId === 'analytics-dashboard') {
            loadAnalytics();
        }
        if (sectionId === 'scorers') { fetchScorers(); fetchPaidPlayersForAutocomplete(); }
    }
}

// ================= MATCH CONTROL (HERO) =================
const MATCH_MAP = {
    'live-match': '00000000-0000-0000-0000-000000000001',
    'upcoming-match': '00000000-0000-0000-0000-000000000002',
    'recent-match': '00000000-0000-0000-0000-000000000003',
    'main-hero': '00000001-0001-0001-0001-000000000000'
};

let currentMatchIdKey = 'live-match';

async function loadHero(matchKey = currentMatchIdKey) {
    currentMatchIdKey = matchKey;
    const dbId = MATCH_MAP[matchKey];
    console.log(`Fetching match data for: ${matchKey} (${dbId})`);

    const { data, error } = await window.safeSupabaseCall(() =>
        supabaseClient
            .from("hero_content")
            .select("*")
            .eq("id", dbId)
            .single()
    );

    if (error && error.code !== 'PGRST116') {
        console.warn("Error loading match:", error.message);
    }

    // Reset fields if no data
    if (!data) {
        document.getElementById("hero-title").value = "";
        document.getElementById("hero-subtitle").value = "";
        document.getElementById("hero-badge").value = matchKey === 'live-match' ? "LIVE NOW" : (matchKey === 'upcoming-match' ? "COMING UP" : "RESULT");
        document.getElementById("hero-team1-name").value = "";
        document.getElementById("hero-team1-score").value = "0";
        document.getElementById("hero-team2-name").value = "";
        document.getElementById("hero-team2-score").value = "0";
        document.getElementById("hero-time").value = "";
        if (document.getElementById("hero-map-url")) document.getElementById("hero-map-url").value = "";

        // Reset Scoring fields too
        if (document.getElementById("hero-wickets")) {
            document.getElementById("hero-wickets").value = 0;
            document.getElementById("hero-overs").value = 0;
            document.getElementById("hero-balls").value = 0;
            document.getElementById("hero-target").value = 0;
            document.getElementById("hero-batsman1").value = "";
            document.getElementById("hero-batsman1-runs").value = 0;
            document.getElementById("hero-batsman1-balls").value = 0;
        }
        return;
    }

    document.getElementById("hero-title").value = data.title || "";
    document.getElementById("hero-subtitle").value = data.subtitle || "";
    document.getElementById("hero-badge").value = data.badge || "";
    document.getElementById("hero-team1-name").value = data.team1_name || "";
    document.getElementById("hero-team1-score").value = data.team1_score || 0;
    document.getElementById("hero-team2-name").value = data.team2_name || "";
    document.getElementById("hero-team2-score").value = data.team2_score || 0;
    document.getElementById("hero-time").value = data.match_status || "";

    // Detailed Scoring Fields
    if (document.getElementById("hero-wickets")) {
        document.getElementById("hero-wickets").value = data.wickets || 0;
        document.getElementById("hero-overs").value = data.overs || 0;
        document.getElementById("hero-balls").value = data.balls || 0;
        document.getElementById("hero-target").value = data.target || 0;
        document.getElementById("hero-batsman1").value = data.batsman1 || "";
        document.getElementById("hero-batsman1-runs").value = data.batsman1_runs || 0;
        document.getElementById("hero-batsman1-balls").value = data.batsman1_balls || 0;

        // Team 2 Details
        if (document.getElementById("hero-t2-wickets")) {
            document.getElementById("hero-t2-wickets").value = data.team2_wickets || 0;
            document.getElementById("hero-t2-overs").value = data.team2_overs || 0;
            document.getElementById("hero-t2-balls").value = data.team2_balls || 0;
        }
    }

    // Toggle scoring panel based on match type
    const scoringPanel = document.getElementById("pro-scoring-panel");
    if (scoringPanel) {
        scoringPanel.style.display = (matchKey === 'live-match' || matchKey === 'recent-match' || matchKey === 'upcoming-match') ? 'block' : 'none';
    }
}

async function saveHero() {
    const submitBtn = document.querySelector('[onclick="saveHero()"]');
    const originalText = submitBtn.innerText;
    submitBtn.innerText = "⏳ Saving...";
    submitBtn.disabled = true;

    const updates = {
        id: MATCH_MAP[currentMatchIdKey],
        title: document.getElementById("hero-title").value,
        subtitle: document.getElementById("hero-subtitle").value,
        badge: document.getElementById("hero-badge").value,
        team1_name: document.getElementById("hero-team1-name").value,
        team1_score: Number(document.getElementById("hero-team1-score").value) || 0,
        team2_name: document.getElementById("hero-team2-name").value,
        team2_score: Number(document.getElementById("hero-team2-score").value) || 0,
        match_status: document.getElementById("hero-time").value,
        // Detailed Scoring (Forced Numeric)
        wickets: Number(document.getElementById("hero-wickets").value) || 0,
        overs: Number(document.getElementById("hero-overs").value) || 0,
        balls: Number(document.getElementById("hero-balls").value) || 0,
        target: Number(document.getElementById("hero-target").value) || 0,
        batsman1: document.getElementById("hero-batsman1").value,
        batsman1_runs: Number(document.getElementById("hero-batsman1-runs").value) || 0,
        batsman1_balls: Number(document.getElementById("hero-batsman1-balls").value) || 0,
        team2_wickets: document.getElementById("hero-t2-wickets") ? (Number(document.getElementById("hero-t2-wickets").value) || 0) : 0,
        team2_overs: document.getElementById("hero-t2-overs") ? (Number(document.getElementById("hero-t2-overs").value) || 0) : 0,
        team2_balls: document.getElementById("hero-t2-balls") ? (Number(document.getElementById("hero-t2-balls").value) || 0) : 0
    };

    const { error } = await window.safeSupabaseCall(() =>
        supabaseClient.from("hero_content").upsert([updates])
    );

    if (error) {
        alert("❌ Error updating: " + error.message);
    } else {
        alert(`✅ ${currentMatchIdKey.replace('-', ' ').toUpperCase()} Updated Successfully!`);
    }

    submitBtn.innerText = originalText;
    submitBtn.disabled = false;
}

// Quick Scoring Functions
function quickScore(runs) {
    const scoreVal = document.getElementById("hero-team1-score"); // Usually home team is batting
    const currentScore = parseInt(scoreVal.value) || 0;
    scoreVal.value = currentScore + runs;
    quickBall(); // Every run counted usually means a ball delivery unless wide/nb (keeping it simple for user)
}

function quickWicket() {
    const wktVal = document.getElementById("hero-wickets");
    const currentWkts = parseInt(wktVal.value) || 0;
    wktVal.value = currentWkts + 1;
    quickBall();
}

function quickBall() {
    const ballsVal = document.getElementById("hero-balls");
    const oversVal = document.getElementById("hero-overs");
    let b = parseInt(ballsVal.value) || 0;
    let o = parseInt(oversVal.value) || 0;

    if (o >= 6) {
        showToast("Innings limit (6 overs) reached!", "info");
        return;
    }

    b++;
    if (b >= 6) {
        b = 0;
        o++;
    }

    ballsVal.value = b;
    oversVal.value = o;

    if (o === 6 && b === 0) {
        showToast("Innings Completed (6.0 Overs)", "success");
    }
}

// ================= NAVIGATION MENU =================
async function fetchAdminMenu() {
    const list = document.getElementById("admin-menu-list");
    const { data } = await window.safeSupabaseCall(() =>
        supabaseClient
            .from("nav_menu")
            .select("*")
            .order("order_index", { ascending: true })
    );

    if (data && data.length > 0) {
        list.innerHTML = data.map(item => createMenuRowHtml(item)).join("");
    } else {
        // Auto-populate with default items if DB is empty
        console.warn("No nav items found, seeding defaults...");
        const defaults = [
            { label: 'Home', link: 'index.html', order_index: 1, is_active: true },
            { label: 'Scorecard', link: 'scorecard.html', order_index: 2, is_active: true },
            { label: 'Squads', link: 'squads.html', order_index: 3, is_active: true },
            { label: 'Fixtures', link: 'fixtures.html', order_index: 4, is_active: true },
            { label: 'Players', link: 'players.html', order_index: 5, is_active: true },
            { label: 'Admin Panel', link: 'admin.html', order_index: 6, is_active: true },
            { label: 'Register Now', link: 'registration.html', order_index: 7, is_active: true },
        ];
        list.innerHTML = defaults.map(item => createMenuRowHtml(item)).join("");
        await window.safeSupabaseCall(() =>
            supabaseClient.from("nav_menu").insert(defaults)
        );
        fetchAdminMenu();
    }
}

const NAV_PAGES = [
    { label: '— Select a Page —', link: '' },
    { label: '🏠 Home', link: 'index.html' },
    { label: '📺 Scorecard', link: 'scorecard.html' },
    { label: '🛡️ Squads', link: 'squads.html' },
    { label: '📅 Fixtures', link: 'fixtures.html' },
    { label: '🏏 Players', link: 'players.html' },
    { label: '⚙️ Admin Panel', link: 'admin.html' },
    { label: '🏷️ Register Now', link: 'registration.html' },
    { label: '🔴 Live Auction', link: 'auction.html' },
    { label: '📝 Custom URL', link: '__custom__' },
];

function createMenuRowHtml(item = { id: '', label: '', link: '', order_index: 0, is_active: true }) {
    const pageOptions = NAV_PAGES.map(p =>
        `<option value="${p.link}" ${item.link === p.link ? 'selected' : ''}>${p.label}</option>`
    ).join('');

    const isCustom = !NAV_PAGES.some(p => p.link === item.link && p.link !== '' && p.link !== '__custom__');

    return `
        <tr data-id="${item.id || ''}">
            <td><input type="number" class="table-input menu-order" value="${item.order_index}" style="width: 60px;"></td>
            <td><input type="text" class="table-input menu-label" value="${item.label}" placeholder="Display Label"></td>
            <td style="min-width:220px;">
                <select class="table-input menu-link-picker" onchange="onNavPagePick(this)" style="margin-bottom:6px;">
                    ${pageOptions}
                </select>
                <input type="text" class="table-input menu-link" value="${item.link}" placeholder="or type custom URL"
                    style="${!isCustom ? 'display:none;' : ''}font-size:0.82rem;">
            </td>
            <td>
                <select class="table-input menu-active">
                    <option value="true" ${item.is_active ? 'selected' : ''}>Active</option>
                    <option value="false" ${!item.is_active ? 'selected' : ''}>Hidden</option>
                </select>
            </td>
            <td>
                <button onclick="this.closest('tr').remove()" class="btn-secondary"
                    style="background:#ef4444;border:none;padding:6px 12px;border-radius:8px;">🗑</button>
            </td>
        </tr>
    `;
}

function onNavPagePick(select) {
    const row = select.closest('tr');
    const customInput = row.querySelector('.menu-link');
    const label = row.querySelector('.menu-label');
    if (select.value === '__custom__') {
        customInput.style.display = '';
        customInput.value = '';
        customInput.focus();
    } else {
        customInput.style.display = 'none';
        customInput.value = select.value;
        // Auto-fill label if it's empty
        const chosen = NAV_PAGES.find(p => p.link === select.value);
        if (chosen && !label.value) label.value = chosen.label.replace(/^[^ ]+ /, '');
    }
}

function addMenuRow() {
    const list = document.getElementById("admin-menu-list");
    list.insertAdjacentHTML('beforeend', createMenuRowHtml());
}

async function saveMenu() {
    const rows = document.querySelectorAll("#admin-menu-list tr");
    const menuItems = Array.from(rows).map(row => ({
        label: row.querySelector(".menu-label").value,
        // Use the select picker value, but fall back to the text input for custom URLs
        link: row.querySelector(".menu-link").value || row.querySelector(".menu-link-picker").value,
        order_index: parseInt(row.querySelector(".menu-order").value) || 0,
        is_active: row.querySelector(".menu-active").value === 'true'
    }));

    // Logic: Delete all and re-insert is easier for small lists
    await window.safeSupabaseCall(() =>
        supabaseClient.from("nav_menu").delete().not('id', 'is', null)
    );

    const { error } = await window.safeSupabaseCall(() =>
        supabaseClient.from("nav_menu").insert(menuItems)
    );

    if (error) {
        showToast("Error saving menu: " + error.message, "error");
    } else {
        showToast("✅ Navbar menu published!", "success");
        fetchAdminMenu();
    }
}

// ─────────────────────────────────────────────────
// MENU TAB SWITCHER
// ─────────────────────────────────────────────────
function switchMenuTab(tab) {
    const desktopPanel = document.getElementById("menu-tab-desktop-panel");
    const mobilePanel = document.getElementById("menu-tab-mobile-panel");
    const desktopBtn = document.getElementById("menu-tab-desktop-btn");
    const mobileBtn = document.getElementById("menu-tab-mobile-btn");
    if (!desktopPanel || !mobilePanel) return;

    if (tab === "desktop") {
        desktopPanel.style.display = "";
        mobilePanel.style.display = "none";
        desktopBtn.style.borderColor = "var(--secondary)";
        desktopBtn.style.background = "rgba(0,242,255,0.12)";
        desktopBtn.style.color = "var(--secondary)";
        mobileBtn.style.borderColor = "transparent";
        mobileBtn.style.background = "transparent";
        mobileBtn.style.color = "var(--text-dim)";
    } else {
        desktopPanel.style.display = "none";
        mobilePanel.style.display = "";
        mobileBtn.style.borderColor = "var(--secondary)";
        mobileBtn.style.background = "rgba(0,242,255,0.12)";
        mobileBtn.style.color = "var(--secondary)";
        desktopBtn.style.borderColor = "transparent";
        desktopBtn.style.background = "transparent";
        desktopBtn.style.color = "var(--text-dim)";
        fetchMobileMenu();
    }
}

// ─────────────────────────────────────────────────
// MOBILE HAMBURGER MENU CRUD  (mobile_menu table)
// ─────────────────────────────────────────────────
let _mobileMenuLoaded = false;

async function fetchMobileMenu() {
    if (_mobileMenuLoaded) return;
    _mobileMenuLoaded = true;
    const list = document.getElementById("mobile-menu-list");
    if (!list) return;
    list.innerHTML = "<tr><td colspan='5' style='text-align:center;padding:20px;color:var(--text-dim);'>Loading...</td></tr>";

    const { data } = await window.safeSupabaseCall(() =>
        supabaseClient.from("mobile_menu").select("*").order("order_index", { ascending: true })
    );

    if (data && data.length > 0) {
        list.innerHTML = data.map(item => createMenuRowHtml(item)).join("");
    } else {
        const mobileDefaults = [
            { label: "Scorecard", link: "scorecard.html", order_index: 1, is_active: true },
            { label: "Admin Panel", link: "admin.html", order_index: 2, is_active: true },
            { label: "Players", link: "players.html", order_index: 3, is_active: true },
            { label: "Squads", link: "squads.html", order_index: 4, is_active: true },
            { label: "Fixtures", link: "fixtures.html", order_index: 5, is_active: true },
        ];
        list.innerHTML = mobileDefaults.map(item => createMenuRowHtml(item)).join("");
        await window.safeSupabaseCall(() => supabaseClient.from("mobile_menu").insert(mobileDefaults));
    }
}

function addMobileMenuRow() {
    const list = document.getElementById("mobile-menu-list");
    list.insertAdjacentHTML("beforeend", createMenuRowHtml());
}

async function saveMobileMenu() {
    const rows = document.querySelectorAll("#mobile-menu-list tr");
    const items = Array.from(rows).map(row => ({
        label: row.querySelector(".menu-label").value,
        link: row.querySelector(".menu-link").value || row.querySelector(".menu-link-picker").value,
        order_index: parseInt(row.querySelector(".menu-order").value) || 0,
        is_active: row.querySelector(".menu-active").value === "true"
    }));

    await window.safeSupabaseCall(() =>
        supabaseClient.from("mobile_menu").delete().not("id", "is", null)
    );
    const { error } = await window.safeSupabaseCall(() =>
        supabaseClient.from("mobile_menu").insert(items)
    );

    if (error) {
        showToast("Error: " + error.message, "error");
    } else {
        showToast("📱 Mobile Menu published! Changes live on next page load.", "success");
        _mobileMenuLoaded = false;
        fetchMobileMenu();
    }
}

// ================= REGISTRATIONS =================
async function fetchRegistrations(statusFilter = 'all') {
    const list = document.getElementById("registrations-list");

    let query = supabaseClient
        .from("player_registrations")
        .select("*")
        .order("created_at", { ascending: false });

    if (statusFilter !== 'all') {
        query = query.eq("payment_status", statusFilter);
    }

    const { data, error } = await window.safeSupabaseCall(() => query);
    if (error) {
        console.error("Fetch error:", error);
        return;
    }

    list.innerHTML = data.map(player => `
        <tr>
            <td>${new Date(player.created_at).toLocaleDateString()}</td>
            <td>${player.player_name}</td>
            <td>${player.mobile_number}</td>
            <td>${player.registration_no || '<span style="color:var(--text-dim);">TBD</span>'}</td>
            <td>
                <span class="status-badge ${player.status || player.payment_status}">
                    ${player.status || player.payment_status}
                </span>
            </td>
            <td>
                ${player.photo_url ? `
                    <a href="${encodeURI(player.photo_url)}" target="_blank" style="text-decoration: none;">
                        ${player.photo_url.toLowerCase().endsWith('.pdf') ? `
                            <div style="width: 40px; height: 40px; background: #fee2e2; color: #ef4444; border-radius: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid #fca5a5; font-size: 0.7rem; font-weight: 900;">PDF</div>
                        ` : `
                            <img src="${encodeURI(player.photo_url)}" style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover; border: 1px solid var(--glass-border); cursor: pointer;" title="Click to view full size">
                        `}
                    </a>
                ` : '<span style="color: var(--text-dim)">No Photo</span>'}
            </td>
            <td>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button onclick="openEditModal('${player.id}')" class="btn" style="font-size: 0.75rem; padding: 5px 10px; background: #3b82f6;">Edit Data</button>
                    <button onclick="triggerDirectUpload('${player.id}')" class="btn" style="font-size: 0.75rem; padding: 5px 10px; background: var(--secondary); color: var(--bg-dark);">Add Photo</button>
                    <button onclick="openPhotoEditor('${player.id}', '${player.photo_url}')" class="btn" style="font-size: 0.75rem; padding: 5px 10px; background: var(--primary);">Edit Photo</button>
                    ${player.token || player.registration_no ? `
                        <a href="success.html?id=${player.token || player.registration_no}" target="_blank" class="btn" style="font-size: 0.75rem; padding: 5px 10px; background: #6366f1; color: white; text-decoration: none;">View ID</a>
                    ` : ''}
                    ${player.payment_status !== 'paid' ? `
                        <button onclick="updatePaymentStatus('${player.id}', 'paid')" class="btn" style="font-size: 0.75rem; padding: 5px 10px; background: #22c55e;">Confirm</button>
                    ` : ''}
                    <button onclick="deleteRegistration('${player.id}')" class="btn-secondary" style="font-size: 0.75rem; padding: 5px 10px; background: #ef4444; border: none;">Del</button>
                </div>
            </td>
        </tr>
    `).join("");
}

async function updatePaymentStatus(id, status) {
    if (!confirm(`Update status to ${status}?`)) return;

    try {
        const { data: updated, error } = await window.safeSupabaseCall(() =>
            supabaseClient
                .from("player_registrations")
                .update({ payment_status: status })
                .eq("id", id)
                .select()
        );

        if (error) throw error;

        // If newly paid and has no registration_no, generate it
        if (status === 'paid' && updated && updated[0] && !updated[0].registration_no) {
            const playerRow = updated[0];
            const serialNum = parseInt(playerRow.reg_serial);
            if (!isNaN(serialNum)) {
                const registrationNo = `OSATPL01S${(serialNum + 2000).toString().padStart(4, "0")}`;
                console.log("Confirmed Reg No:", registrationNo, "from Serial:", serialNum);

                const { error: regError } = await window.safeSupabaseCall(() =>
                    supabaseClient
                        .from("player_registrations")
                        .update({ registration_no: registrationNo })
                        .eq("id", id)
                );

                if (regError) console.warn("Error generating reg_no:", regError.message);
            }
        }

        fetchRegistrations();
    } catch (err) {
        if (window.isNetworkError(err)) {
            const health = await window.testSupabaseConnection();
            alert(health.detailed);
        } else {
            alert("Error: " + (err.message || err));
        }
    }
}

async function deleteRegistration(id) {
    if (!confirm("Delete this registration?")) return;
    await window.safeSupabaseCall(() =>
        supabaseClient.from("player_registrations").delete().eq("id", id)
    );
    fetchRegistrations();
}

// ================= EDIT MODAL LOGIC =================
function closeEditModal() {
    document.getElementById("edit-modal").style.display = "none";
}

async function openEditModal(id) {
    console.log("🛠️ Attempting to open edit modal for ID:", id);
    const { data, error } = await window.safeSupabaseCall(() =>
        supabaseClient
            .from("player_registrations")
            .select("*")
            .eq("id", id)
            .single()
    );

    if (error) {
        alert("Error fetching player: " + error.message);
        return;
    }

    if (data) {
        document.getElementById("edit-player-id").value = data.id;
        document.getElementById("edit-name").value = data.player_name || "";
        document.getElementById("edit-father").value = data.father_name || "";
        document.getElementById("edit-dob").value = data.date_of_birth || "";
        document.getElementById("edit-aadhar").value = data.aadhar_number || "";
        document.getElementById("edit-mobile").value = data.mobile_number || "";
        document.getElementById("edit-whatsapp").value = data.whatsapp_number || "";
        document.getElementById("edit-batting").value = data.batting || "right";
        document.getElementById("edit-bowling").value = data.bowling || "right";
        document.getElementById("edit-wk").value = data.wicket_keeper || "no";

        document.getElementById("edit-modal").style.display = "block";
    }
}

async function saveRegistrationEdit(e) {
    e.preventDefault();
    const id = document.getElementById("edit-player-id").value;
    const saveBtn = e.target.querySelector('button[type="submit"]');
    const originalText = saveBtn.innerText;

    saveBtn.disabled = true;
    saveBtn.innerText = "Updating... ⏳";

    try {
        const updates = {
            player_name: document.getElementById("edit-name").value,
            father_name: document.getElementById("edit-father").value,
            date_of_birth: document.getElementById("edit-dob").value,
            aadhar_number: document.getElementById("edit-aadhar").value,
            mobile_number: document.getElementById("edit-mobile").value,
            whatsapp_number: document.getElementById("edit-whatsapp").value,
            batting: document.getElementById("edit-batting").value,
            bowling: document.getElementById("edit-bowling").value,
            wicket_keeper: document.getElementById("edit-wk").value
        };

        // Handle Optional File Upload (Photo or PDF)
        const fileInput = document.getElementById("edit-file-upload");
        if (fileInput.files.length > 0) {
            saveBtn.innerText = "Uploading File... ⏳";
            const file = fileInput.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `replaced_${id}_${Date.now()}.${fileExt}`;
            const filePath = `player_photos/${fileName}`;

            const { data: uploadData, error: uploadError } = await supabaseClient
                .storage
                .from('player-photos')
                .upload(filePath, file, {
                    contentType: file.type || (fileExt.toLowerCase() === 'pdf' ? 'application/pdf' : 'image/jpeg'),
                    upsert: true
                });

            if (uploadError) throw new Error("File Upload Failed: " + uploadError.message);

            const { data: urlData } = supabaseClient.storage.from('player-photos').getPublicUrl(filePath);
            updates.photo_url = urlData.publicUrl;
        }

        saveBtn.innerText = "Saving Data... ⏳";
        const { error: dbError } = await window.safeSupabaseCall(() =>
            supabaseClient
                .from("player_registrations")
                .update(updates)
                .eq("id", id)
        );

        if (dbError) throw dbError;

        alert("Registration Updated Successfully!");

        // Reset file input for next time
        fileInput.value = "";

        closeEditModal();
        fetchRegistrations();

    } catch (error) {
        console.error("Save Registration Error:", error);
        alert("Error updating: " + error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = originalText;
    }
}

// ================= MANUAL REGISTRATION =================
function openAddModal() {
    document.getElementById("addPlayerForm").reset();
    document.getElementById("add-photo-preview").innerHTML = '<span style="color: var(--text-dim); font-size: 0.8rem;">Photo Preview</span>';
    document.getElementById("add-photo-error").style.display = "none";
    addPlayerPhotoFile = null;
    document.getElementById("add-player-modal").style.display = "block";
}

function closeAddModal() {
    document.getElementById("add-player-modal").style.display = "none";
}

let addPlayerPhotoFile = null;
function handlePlayerPhotoUpload(input) {
    const errorEl = document.getElementById("add-photo-error");
    const previewEl = document.getElementById("add-photo-preview");

    if (input.files && input.files[0]) {
        const file = input.files[0];
        const ext = file.name.split('.').pop().toLowerCase();

        if (!['jpg', 'jpeg', 'pdf'].includes(ext)) {
            errorEl.innerText = "Only JPG or PDF allowed!";
            errorEl.style.display = "block";
            addPlayerPhotoFile = null;
            previewEl.innerHTML = '<span style="color: #ff4d8d;">Invalid File</span>';
            return;
        }

        errorEl.style.display = "none";
        addPlayerPhotoFile = file;

        if (ext === 'pdf') {
            previewEl.innerHTML = '<div style="text-align:center;"><span style="font-size:2rem;">📄</span><br><span style="font-size:0.7rem; color:var(--secondary);">PDF Selected</span></div>';
        } else {
            const reader = new FileReader();
            reader.onload = function (e) {
                previewEl.innerHTML = `<img src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover;">`;
            };
            reader.readAsDataURL(file);
        }
    }
}

async function saveNewPlayer(e) {
    e.preventDefault();
    const submitBtn = document.getElementById("addPlayerSubmitBtn");
    const originalText = submitBtn.innerText;

    try {
        submitBtn.disabled = true;
        submitBtn.innerText = "⏳ Registering...";

        const mobile = document.getElementById("add-mobile").value;
        const aadhar = document.getElementById("add-aadhar").value;

        // 1. Check for duplicates
        const { data: existing, error: checkError } = await window.safeSupabaseCall(() =>
            supabaseClient
                .from("player_registrations")
                .select("id")
                .or(`mobile_number.eq.${mobile},aadhar_number.eq.${aadhar}`)
                .maybeSingle()
        );

        if (existing) {
            throw new Error("This Mobile or Aadhar is already registered!");
        }

        // 2. Upload Photo
        if (!addPlayerPhotoFile) throw new Error("Please upload a player photo.");

        const timestamp = Date.now();
        const ext = addPlayerPhotoFile.name.split('.').pop();
        const fileName = `player_${timestamp}_admin.${ext}`;

        const { error: uploadError } = await supabaseClient.storage
            .from("player-photos")
            .upload(fileName, addPlayerPhotoFile);

        if (uploadError) throw new Error("Photo Upload Failed: " + uploadError.message);

        const { data: photoData } = supabaseClient.storage
            .from("player-photos")
            .getPublicUrl(fileName);

        const photoUrl = photoData.publicUrl;

        // 3. Insert Record
        const { data: inserted, error: insertError } = await window.safeSupabaseCall(() =>
            supabaseClient
                .from("player_registrations")
                .insert([{
                    player_name: document.getElementById("add-name").value,
                    father_name: document.getElementById("add-father").value,
                    date_of_birth: document.getElementById("add-dob").value,
                    aadhar_number: aadhar,
                    mobile_number: mobile,
                    whatsapp_number: document.getElementById("add-whatsapp").value,
                    batting: document.getElementById("add-batting").value,
                    bowling: document.getElementById("add-bowling").value,
                    wicket_keeper: document.getElementById("add-wk").value,
                    photo_url: photoUrl,
                    payment_status: "paid", // Admin entries are usually paid/confirmed
                    payment_id: "ADMIN_ENTRY"
                }])
                .select()
        );

        if (insertError) throw new Error("Database Save Failed: " + insertError.message);

        // 4. Generate Reg No (Robust Numeric Logic using reg_serial)
        const playerRow = inserted[0];
        const serialNum = parseInt(playerRow.reg_serial);

        if (isNaN(serialNum)) {
            throw new Error("ID Generation Error: Serial number is invalid.");
        }

        const registrationNo = `OSATPL01S${(serialNum + 2000).toString().padStart(4, "0")}`;
        console.log("Manual Reg No Generated:", registrationNo, "from Serial:", serialNum);

        const { error: updateError } = await window.safeSupabaseCall(() =>
            supabaseClient
                .from("player_registrations")
                .update({ registration_no: registrationNo })
                .eq("id", playerRow.id)
        );

        if (updateError) throw new Error("Reg No Generation Failed: " + updateError.message);

        alert(`✅ Player Registered Successfully!\nReg No: ${registrationNo}`);
        closeAddModal();
        fetchRegistrations();

    } catch (err) {
        alert("❌ Error: " + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = originalText;
    }
}

// ================= TEAM MANAGEMENT =================
async function fetchAdminTeams() {
    const list = document.getElementById("admin-teams-list");
    if (!list) return;

    // Populate Captain Suggestions Datalist
    populateCaptainDatalist();

    const { data, error } = await window.safeSupabaseCall(() =>
        supabaseClient
            .from("points_table")
            .select("*")
            .order("team_name", { ascending: true })
    );

    if (error) {
        console.error('Error loading teams:', error);
        list.innerHTML = `<tr><td colspan="9" style="color: #ff4d8d;">Error loading teams: ${error.message}</td></tr>`;
        return;
    }

    list.innerHTML = data.map(team => {
        const owners = Array.isArray(team.owners) ? team.owners : (team.owner_name ? [{ name: team.owner_name, photo: team.owner_photo }] : []);

        return `
        <tr data-id="${team.id}">
            <td><input type="text" value="${team.group_name}" class="table-input group-input" style="width: 40px; text-align: center;"></td>
            <td><input type="text" value="${team.team_name}" class="table-input team-name-input"></td>
            <!-- Logo -->
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 35px; height: 35px; border-radius: 50%; overflow: hidden; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border);">
                        <img src="${team.logo_url || 'logo.png'}" class="logo-preview" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <label class="photo-upload-label">
                        Upload
                        <input type="file" class="logo-upload-input" accept="image/*" onchange="handleLogoSelect(this)">
                    </label>
                    <input type="hidden" value="${team.logo_url || ''}" class="logo-url-hidden">
                </div>
            </td>
            <!-- Owners List -->
            <td>
                <div class="owners-container" style="display: flex; flex-direction: column; gap: 10px; min-width: 250px;">
                    <div class="owners-list">
                        ${owners.map((owner, idx) => renderOwnerRow(owner, idx)).join('')}
                    </div>
                    <button onclick="addOwnerRow(this)" class="btn-secondary" style="font-size: 0.7rem; padding: 4px 8px; width: fit-content;">+ Add More Owner</button>
                </div>
            </td>
            <!-- Captain -->
            <td><input type="text" value="${team.captain_name || ''}" class="table-input captain-name-input" placeholder="Captain Name" list="players-datalist"></td>
            <!-- Captain Photo -->
            <td>
                <div class="photo-upload-cell">
                    <div class="mini-preview">
                        ${team.captain_photo ? `<img src="${team.captain_photo}" class="row-photo-preview captain-photo-img">` : `<span>🏏</span>`}
                    </div>
                    <label class="photo-upload-label">
                        Upload
                        <input type="file" class="captain-photo-input" accept="image/*" onchange="handleRowPhotoSelect(this, 'captain')">
                    </label>
                    <input type="hidden" value="${team.captain_photo || ''}" class="captain-photo-hidden">
                </div>
            </td>
            <td><input type="text" value="${team.owner_password || ''}" class="table-input pass-input"></td>
            <td>
                <button onclick="previewTeam('${team.id}')" class="btn-secondary" style="padding: 5px; min-width: 35px; border-radius: 8px;" title="Quick View">👁️</button>
                <button onclick="deleteTeam('${team.id}')" class="btn-secondary" style="padding: 5px; min-width: 35px; color: #ff4d8d;">🗑️</button>
            </td>
        </tr>
    `;
    }).join("");
}

function renderOwnerRow(owner = { name: '', photo: '' }, index) {
    return `
        <div class="owner-entry" style="display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.03); padding: 5px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
            <div class="mini-preview" style="width: 30px; height: 30px; border-radius: 50%; overflow: hidden; border: 1px solid var(--glass-border);">
                ${owner.photo ? `<img src="${owner.photo}" class="owner-photo-img" style="width:100%; height:100%; object-fit: cover;">` : `<span style="font-size: 1rem; display: flex; align-items: center; justify-content: center; height: 100%;">👤</span>`}
            </div>
            <input type="text" value="${owner.name}" class="table-input owner-name-input" placeholder="Owner Name" style="font-size: 0.8rem; padding: 4px 8px;">
            <label class="photo-upload-label" style="font-size: 0.6rem; padding: 3px 6px;">
                📷
                <input type="file" class="owner-photo-input" accept="image/*" style="display: none;" onchange="handleOwnerPhotoSelect(this)">
            </label>
            <input type="hidden" value="${owner.photo}" class="owner-photo-url-hidden">
            <button onclick="this.closest('.owner-entry').remove()" class="btn-secondary" style="padding: 2px 6px; color: #ff4d8d; background: none; border: none; font-size: 1rem;" title="Remove Owner">×</button>
        </div>
    `;
}

function addOwnerRow(btn) {
    const list = btn.closest('.owners-container').querySelector('.owners-list');
    const div = document.createElement('div');
    div.innerHTML = renderOwnerRow();
    list.appendChild(div.firstElementChild);
}

function handleOwnerPhotoSelect(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        const entry = input.closest('.owner-entry');
        const previewImg = entry.querySelector('.owner-photo-img');
        const previewDiv = entry.querySelector('.mini-preview');

        reader.onload = function (e) {
            if (previewImg) {
                previewImg.src = e.target.result;
            } else {
                previewDiv.innerHTML = `<img src="${e.target.result}" class="owner-photo-img" style="width:100%; height:100%; object-fit: cover;">`;
            }
            showToast("Owner photo ready!", "info");
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function saveTeamDetails() {
    const rows = document.querySelectorAll("#admin-teams-list tr");
    const saveBtn = document.querySelector('button[onclick="saveTeamDetails()"]');
    saveBtn.disabled = true;
    saveBtn.innerText = "Saving & Uploading...";

    try {
        const updates = await Promise.all(Array.from(rows).map(async (row) => {
            const uploadFile = async (fileInput, currentUrl, prefix) => {
                if (fileInput && fileInput.files.length > 0) {
                    const file = fileInput.files[0];
                    const timestamp = Date.now();
                    const fileName = `${prefix}_${timestamp}_${Math.floor(Math.random() * 1000)}.png`;
                    const { error: uploadError } = await supabaseClient.storage.from("player-photos").upload(fileName, file);
                    if (!uploadError) {
                        const { data: photoData } = supabaseClient.storage.from("player-photos").getPublicUrl(fileName);
                        return photoData.publicUrl;
                    }
                }
                return currentUrl;
            };

            // 1. Upload Logo
            const logoUrl = await uploadFile(row.querySelector(".logo-upload-input"), row.querySelector(".logo-url-hidden").value, "logo");

            // 2. Upload Captain Photo
            const captainPhotoUrl = await uploadFile(row.querySelector(".captain-photo-input"), row.querySelector(".captain-photo-hidden").value, "captain");

            // 3. Process Multiple Owners
            const ownerEntries = row.querySelectorAll(".owner-entry");
            const owners = await Promise.all(Array.from(ownerEntries).map(async (entry) => {
                const name = entry.querySelector(".owner-name-input").value.trim();
                const photoUrl = await uploadFile(entry.querySelector(".owner-photo-input"), entry.querySelector(".owner-photo-url-hidden").value, "owner");
                return { name, photo: photoUrl };
            }));

            // Filter out empty owners
            const activeOwners = owners.filter(o => o.name);

            return {
                id: parseInt(row.dataset.id),
                group_name: row.querySelector(".group-input").value.trim().toUpperCase(),
                team_name: row.querySelector(".team-name-input").value,
                logo_url: logoUrl,
                owners: activeOwners,
                // Legacy support (optional, keep for safety)
                owner_name: activeOwners[0]?.name || '',
                owner_photo: activeOwners[0]?.photo || '',
                captain_name: row.querySelector(".captain-name-input").value,
                captain_photo: captainPhotoUrl,
                owner_password: row.querySelector(".pass-input").value
            };
        }));

        const { error } = await supabaseClient.from("points_table").upsert(updates);
        if (error) throw error;
        showToast("Team Details saved successfully!", "success");
        fetchAdminTeams();
    } catch (err) {
        showToast("Error saving: " + err.message, "error");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = "Save Team Branding";
    }
}

async function populateCaptainDatalist() {
    const datalist = document.getElementById("players-datalist");
    if (!datalist) return;

    try {
        const { data, error } = await window.safeSupabaseCall(() =>
            supabaseClient
                .from("player_registrations")
                .select("player_name")
                .order("player_name", { ascending: true })
        );

        if (error) throw error;

        if (data) {
            // Use a Set to ensure unique names
            const uniqueNames = [...new Set(data.map(p => p.player_name).filter(Boolean))];
            datalist.innerHTML = uniqueNames.map(name => `<option value="${name}">`).join("");
            console.log(`✅ Captain Datalist Populated with ${uniqueNames.length} unique players`);
        }
    } catch (err) {
        console.error("Error populating captain datalist:", err);
    }
}

// ================= POINTS TABLE =================
async function fetchAdminPoints() {
    const list = document.getElementById("admin-points-list");
    if (!list) return;

    const { data, error } = await window.safeSupabaseCall(() =>
        supabaseClient
            .from("points_table")
            .select("*")
            .order("points", { ascending: false })
    );

    if (error) {
        console.error('Error loading points table:', error);
        list.innerHTML = `<tr><td colspan="12" style="color: #ff4d8d;">Error loading points: ${error.message}</td></tr>`;
        return;
    }

    if (!data || data.length === 0) {
        list.innerHTML = `<tr><td colspan="12" style="color: var(--text-dim);">No teams found.</td></tr>`;
        return;
    }

    list.innerHTML = data.map(team => `
        <tr data-id="${team.id}">
            <td><input type="text" value="${team.group_name || 'A'}" class="table-input group-input" style="width: 50px; text-align: center; font-weight: 800;"></td>
            <td style="font-weight: 700; color: #fff;">${team.team_name || ''}</td>
            <td><input type="number" value="${team.played}" class="table-input played-input" oninput="calculateStats(this)"></td>
            <td><input type="number" value="${team.won}" class="table-input won-input" oninput="calculateStats(this)"></td>
            <td><input type="number" value="${team.lost}" class="table-input lost-input" oninput="calculateStats(this)"></td>
            <td><input type="number" value="${team.runs_scored || 0}" class="table-input rs-input" oninput="calculateStats(this)"></td>
            <td><input type="number" value="${team.overs_faced || 0}" step="0.1" class="table-input of-input" oninput="calculateStats(this)"></td>
            <td><input type="number" value="${team.runs_conceded || 0}" class="table-input rc-input" oninput="calculateStats(this)"></td>
            <td><input type="number" value="${team.overs_bowled || 0}" step="0.1" class="table-input ob-input" oninput="calculateStats(this)"></td>
            <td><input type="number" value="${team.nrr || 0}" class="table-input nrr-input" readonly style="background: rgba(0,0,0,0.1);"></td>
            <td><input type="number" value="${team.points}" class="table-input points-input" readonly style="font-weight: bold; color: var(--secondary); background: rgba(0,0,0,0.2); cursor: not-allowed;"></td>
            <td><input type="number" value="${team.budget || 4000}" class="table-input budget-input" style="font-weight: bold; color: var(--secondary);"></td>
            <td>
                <button onclick="previewTeam('${team.id}')" class="btn-secondary" style="padding: 5px; min-width: 35px; border-radius: 8px;" title="Quick View">👁️</button>
            </td>
        </tr>
    `).join("");
}

async function addNewTeamRow() {
    const { data, error } = await supabaseClient.from("points_table").insert([{
        team_name: "New Team",
        group_name: "A",
        budget: 4000,
        owner_password: "123456",
        owner_name: "",
        captain_name: "",
        owner_photo: "",
        captain_photo: ""
    }]).select();

    if (error) {
        alert("Error adding team: " + error.message);
    } else {
        showToast("New team added! Please edit the name and save.", "success");
        if (document.getElementById('teams-section').classList.contains('active')) {
            fetchAdminTeams();
        } else {
            fetchAdminPoints();
        }
    }
}

async function deleteTeam(id) {
    if (!confirm("Are you sure you want to delete this team? This will remove all their stats!")) return;

    const { error } = await supabaseClient.from("points_table").delete().eq("id", id);

    if (error) {
        alert("Error deleting team: " + error.message);
    } else {
        showToast("Team deleted!", "info");
        if (document.getElementById('teams-section').classList.contains('active')) {
            fetchAdminTeams();
        } else {
            fetchAdminPoints();
        }
    }
}

// Handle local logo selection for preview
function handleLogoSelect(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        const row = input.closest('tr');
        const previewImg = row.querySelector('.logo-preview');
        const previewDiv = previewImg ? null : row.querySelector('div[onclick^="previewTeam"]');

        reader.onload = function (e) {
            if (previewImg) {
                previewImg.src = e.target.result;
            } else if (previewDiv) {
                previewDiv.innerHTML = `<img src="${e.target.result}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            }
            showToast("Logo ready! Click 'Save All Changes' to upload.", "info");
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// Handle Owner/Captain photo selection
function handleRowPhotoSelect(input, type) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        const row = input.closest('tr');
        const previewImg = row.querySelector(`.${type}-photo-img`);
        const previewDiv = previewImg ? null : row.querySelector(`.${type}-photo-input`).closest('.photo-upload-cell').querySelector('.mini-preview');

        reader.onload = function (e) {
            if (previewImg) {
                previewImg.src = e.target.result;
            } else if (previewDiv) {
                previewDiv.innerHTML = `<img src="${e.target.result}" class="row-photo-preview">`;
            }
            showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} photo ready! Click 'Save' to upload.`, "info");
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// Quick Preview for Team Details
async function previewTeam(teamId) {
    const modal = document.getElementById("team-details-modal");
    const logoImg = document.getElementById("preview-team-logo");
    const teamNameEl = document.getElementById("preview-team-name");
    const ownerNameEl = document.getElementById("preview-owner-name");

    // Show loading state
    teamNameEl.innerText = "Loading...";
    ownerNameEl.innerText = "...";
    logoImg.src = "img.svg";
    modal.style.display = "block";

    const { data, error } = await supabaseClient
        .from("points_table")
        .select("*")
        .eq("id", teamId)
        .single();

    if (error || !data) {
        alert("Error loading team details: " + (error?.message || "Not found"));
        modal.style.display = "none";
        return;
    }

    // Populate Modal
    logoImg.src = data.logo_url || "logo.png";
    teamNameEl.innerText = data.team_name || "Unknown Team";
    ownerNameEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 15px; margin-top: 20px;">
            <div style="display: flex; align-items: center; gap: 20px; background: rgba(255,255,255,0.05); padding: 15px; border-radius: 15px;">
                <img src="${data.owner_photo || 'img.svg'}" style="width: 50px; height: 50px; border-radius: 50%; border: 2px solid var(--primary);">
                <div>
                    <div style="font-size: 0.7rem; color: var(--text-dim);">OWNER</div>
                    <div style="font-weight: 800; color: white;">${data.owner_name || 'Not Set'}</div>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 20px; background: rgba(255,255,255,0.05); padding: 15px; border-radius: 15px;">
                <img src="${data.captain_photo || 'img.svg'}" style="width: 50px; height: 50px; border-radius: 50%; border: 2px solid var(--secondary);">
                <div>
                    <div style="font-size: 0.7rem; color: var(--text-dim);">CAPTAIN</div>
                    <div style="font-weight: 800; color: white;">${data.captain_name || 'Not Set'}</div>
                </div>
            </div>
        </div>
    `;
}

// Global function to auto-calculate Points & NRR
function calculateStats(input) {
    const row = input.closest('tr');

    // 1. Calculate Points (Win = 2)
    const won = parseInt(row.querySelector('.won-input').value) || 0;
    row.querySelector('.points-input').value = won * 2;

    // 2. Calculate NRR
    const rs = parseFloat(row.querySelector('.rs-input').value) || 0;
    const of = parseFloat(row.querySelector('.of-input').value) || 0;
    const rc = parseFloat(row.querySelector('.rc-input').value) || 0;
    const ob = parseFloat(row.querySelector('.ob-input').value) || 0;

    let nrr = 0;
    if (of > 0 && ob > 0) {
        nrr = (rs / of) - (rc / ob);
    }

    row.querySelector('.nrr-input').value = nrr.toFixed(3);
    console.log(`📊 Stats Sync: Points=${won * 2}, NRR=${nrr.toFixed(3)}`);
}

async function savePointsTable() {
    const rows = document.querySelectorAll("#admin-points-list tr");
    const saveBtn = document.querySelector("button[onclick='savePointsTable()']");
    if (!saveBtn) return;
    const originalText = saveBtn.innerText;

    saveBtn.innerText = "⏳ Saving Stats...";
    saveBtn.disabled = true;

    try {
        const updates = Array.from(rows).map(row => ({
            id: parseInt(row.dataset.id),
            group_name: row.querySelector(".group-input").value.trim().toUpperCase(),
            played: parseInt(row.querySelector(".played-input").value) || 0,
            won: parseInt(row.querySelector(".won-input").value) || 0,
            lost: parseInt(row.querySelector(".lost-input").value) || 0,
            runs_scored: parseInt(row.querySelector(".rs-input").value) || 0,
            overs_faced: parseFloat(row.querySelector(".of-input").value) || 0,
            runs_conceded: parseInt(row.querySelector(".rc-input").value) || 0,
            overs_bowled: parseFloat(row.querySelector(".ob-input").value) || 0,
            nrr: parseFloat(row.querySelector(".nrr-input").value) || 0,
            points: parseInt(row.querySelector(".points-input").value) || 0,
            budget: parseInt(row.querySelector(".budget-input").value) || 0
        }));

        const { error } = await supabaseClient.from("points_table").upsert(updates);

        if (error) {
            alert("Error saving: " + error.message);
        } else {
            showToast("Points Table stats saved!", "success");
            fetchAdminPoints();
        }
    } catch (err) {
        console.error("Save Error:", err);
        alert("An error occurred while saving.");
    } finally {
        saveBtn.innerText = originalText;
        saveBtn.disabled = false;
    }
}

// ================= TEAM ROSTERS =================
async function loadRosterTeams() {
    const select = document.getElementById("roster-team-select");
    const { data } = await supabaseClient.from("points_table").select("id, team_name").order("team_name");

    if (data) {
        select.innerHTML = '<option value="">Select Team</option>' +
            data.map(t => `<option value="${t.id}">${t.team_name}</option>`).join("");
    }
}

async function fetchAdminRoster() {
    const teamId = document.getElementById("roster-team-select").value;
    const list = document.getElementById("admin-roster-list");

    if (!teamId) {
        list.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-dim); padding: 50px;">Please select a team to manage squad</td></tr>';
        return;
    }

    const { data } = await supabaseClient
        .from("team_players")
        .select("*")
        .eq("team_id", teamId)
        .order("id");

    // Generate 13 rows
    let rowsHtml = "";
    for (let i = 0; i < 13; i++) {
        const p = (data && data[i]) || { reg_no: "", player_name: "", playing_format: "Allrounder", is_wicket_keeper: false };
        rowsHtml += `
            <tr data-index="${i}" data-id="${p.id || ''}" data-batting="${p.batting_style || ''}" data-bowling="${p.bowling_style || ''}">
                <td style="color: var(--text-dim);">${i + 1}</td>
                <td>
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <input type="text" class="table-input player-reg" value="${p.reg_no || ''}" placeholder="Reg No" style="width: 100px;">
                        <button class="btn" style="padding: 5px 8px; font-size: 0.8rem; background: var(--secondary); color: var(--bg-dark);" onclick="handleRosterRegNoInput(this)">🔍</button>
                    </div>
                </td>
                <td><input type="text" class="table-input player-name" value="${p.player_name}" placeholder="Player Name"></td>
                <td>
                    <select class="table-input player-format">
                        <option value="Batting" ${p.playing_format === 'Batting' ? 'selected' : ''}>Batting</option>
                        <option value="Bowling" ${p.playing_format === 'Bowling' ? 'selected' : ''}>Bowling</option>
                        <option value="Allrounder" ${p.playing_format === 'Allrounder' ? 'selected' : ''}>Allrounder</option>
                    </select>
                </td>
                <td style="text-align: center;">
                    <input type="checkbox" class="player-wk" ${p.is_wicket_keeper ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer;">
                </td>
            </tr>
        `;
    }
    list.innerHTML = rowsHtml;
}

async function handleRosterRegNoInput(btn) {
    const row = btn.closest('tr');
    const input = row.querySelector('.player-reg');
    const regNo = input.value.trim();

    if (!regNo) return alert("Please enter a Registration No first!");

    const originalText = btn.innerText;
    btn.innerText = "⏳";
    btn.disabled = true;

    console.log(`🔍 Fetching details for Registration No: ${regNo}...`);

    try {
        const { data, error } = await window.safeSupabaseCall(() =>
            supabaseClient
                .from('player_registrations')
                .select('*')
                .eq('registration_no', regNo)
                .single()
        );

        if (error || !data) {
            alert("❌ Player not found with this Registration No.");
            return;
        }

        // Auto-fill the fields from database
        row.querySelector('.player-name').value = data.player_name || "";

        // Auto-select Role/Format (Intelligent Mapping)
        const formatSelect = row.querySelector('.player-format');
        const isBatsman = data.batting && data.batting !== 'no';
        const isBowler = data.bowling && data.bowling !== 'no';

        if (isBatsman && isBowler) {
            formatSelect.value = "Allrounder";
        } else if (isBatsman) {
            formatSelect.value = "Batting";
        } else if (isBowler) {
            formatSelect.value = "Bowling";
        }

        const wkCheck = row.querySelector('.player-wk');
        wkCheck.checked = (data.wicket_keeper && data.wicket_keeper.toLowerCase() === "yes");

        // Store descriptive styles for display on squads page
        const battingMap = { 'right': 'Right Hand Bat', 'left': 'Left Hand Bat', 'no': '' };
        const bowlingMap = { 'right': 'Right Arm Bowl', 'left': 'Left Arm Bowl', 'no': '' };

        row.dataset.batting = battingMap[data.batting] || "";
        row.dataset.bowling = bowlingMap[data.bowling] || "";

        console.log("✅ Player details (Format, Style, WK) auto-filled!");
    } catch (err) {
        console.error("Fetch Error:", err);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function saveRoster() {
    const teamId = document.getElementById("roster-team-select").value;
    const teamName = document.getElementById("roster-team-select").options[document.getElementById("roster-team-select").selectedIndex].text;
    if (!teamId) return alert("Select a team first");

    const rows = document.querySelectorAll("#admin-roster-list tr");
    const players = [];

    rows.forEach(row => {
        const name = row.querySelector(".player-name").value.trim();
        const regNo = row.querySelector(".player-reg").value.trim();
        if (name) {
            const player = {
                team_id: parseInt(teamId),
                team_name: teamName,
                player_name: name,
                reg_no: regNo,
                playing_format: row.querySelector(".player-format").value,
                is_wicket_keeper: row.querySelector(".player-wk").checked,
                // Extra details from dataset (stored during auto-fetch or existing data)
                batting_style: row.dataset.batting || "",
                bowling_style: row.dataset.bowling || ""
            };
            if (row.dataset.id) player.id = row.dataset.id;
            players.push(player);
        }
    });

    // Delete existing team players and batch insert
    await supabaseClient.from("team_players").delete().eq("team_id", teamId);

    // 2. Insert new list
    const { error } = await supabaseClient.from("team_players").insert(players);

    if (error) {
        alert("Error saving roster: " + error.message);
    } else {
        alert("Squad Saved Successfully!");
        fetchAdminRoster();
        loadAnalytics(); // Refresh analytics after squad change
    }
}

// ================= SITE SETTINGS =================
async function loadSettings() {
    const { data } = await supabaseClient
        .from("site_settings")
        .select("*")
        .eq("id", "global-settings")
        .single();

    if (data) {
        document.getElementById("set-mobile1").value = data.mobile1 || "";
        document.getElementById("set-mobile2").value = data.mobile2 || "";
        document.getElementById("set-whatsapp1").value = data.whatsapp1 || "";
        document.getElementById("set-whatsapp2").value = data.whatsapp2 || "";
        document.getElementById("set-email").value = data.email || "";
        document.getElementById("set-facebook").value = data.facebook_url || "";
        if (document.getElementById("set-map-url")) {
            document.getElementById("set-map-url").value = data.map_url || "";
        }
        if (document.getElementById("set-reg-end")) {
            document.getElementById("set-reg-end").value = data.reg_end_date || "";
        }

        // Developer Settings
        if (document.getElementById("set-dev-name")) document.getElementById("set-dev-name").value = data.dev_name || "";
        if (document.getElementById("set-dev-insta")) document.getElementById("set-dev-insta").value = data.dev_insta || "";
        if (document.getElementById("set-dev-web")) document.getElementById("set-dev-web").value = data.dev_web || "";
        if (document.getElementById("set-dev-whatsapp")) document.getElementById("set-dev-whatsapp").value = data.dev_whatsapp || "";

        if (data.qr_code_url) {
            document.getElementById("qr-preview").innerHTML = `<img src="${data.qr_code_url}" style="width: 150px; height: 150px; border-radius: 10px; border: 1px solid var(--glass-border);">`;
        }

        // Global Popup Toggle
        const popupToggle = document.getElementById('popup-enable-toggle');
        if (popupToggle) {
            popupToggle.checked = data.is_popup_enabled === true;
        }
    }
}

let qrFile = null;
function handleQRUpload(input) {
    if (input.files && input.files[0]) {
        qrFile = input.files[0];
        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById("qr-preview").innerHTML = `<img src="${e.target.result}" style="width: 150px; height: 150px; border-radius: 10px; border: 2px solid var(--secondary);">`;
        };
        reader.readAsDataURL(qrFile);
    }
}

async function saveSettings() {
    let qrUrl = null;

    // 1. Upload QR if new one selected
    if (qrFile) {
        const ext = qrFile.name.split('.').pop();
        const fileName = `qr_code_${Date.now()}.${ext}`;
        const { error: uploadError } = await supabaseClient.storage
            .from("player-photos") // Reusing storage bucket
            .upload(fileName, qrFile);

        if (uploadError) {
            alert("QR Upload Failed: " + uploadError.message);
            return;
        }

        const { data } = supabaseClient.storage
            .from("player-photos")
            .getPublicUrl(fileName);
        qrUrl = data.publicUrl;
    }

    // 2. Save Data
    const settings = {
        id: "global-settings",
        mobile1: document.getElementById("set-mobile1").value,
        mobile2: document.getElementById("set-mobile2").value,
        whatsapp1: document.getElementById("set-whatsapp1").value,
        whatsapp2: document.getElementById("set-whatsapp2").value,
        email: document.getElementById("set-email").value,
        facebook_url: ensureAbsoluteUrl(document.getElementById("set-facebook").value),
        map_url: ensureAbsoluteUrl(document.getElementById("set-map-url").value),
        reg_end_date: document.getElementById("set-reg-end").value,
        dev_name: document.getElementById("set-dev-name").value,
        dev_insta: document.getElementById("set-dev-insta").value,
        dev_web: ensureAbsoluteUrl(document.getElementById("set-dev-web").value),
        dev_whatsapp: document.getElementById("set-dev-whatsapp").value
    };

    if (qrUrl) settings.qr_code_url = qrUrl;

    const { error } = await supabaseClient.from("site_settings").upsert([settings]);

    if (error) {
        alert("Error saving settings: " + error.message);
    } else {
        alert("Site Settings Updated Successfully!");
        qrFile = null;
        loadSettings();
    }
}

async function togglePopupSetting(enabled) {
    console.log("Setting Global Popup:", enabled);
    const { error } = await supabaseClient
        .from("site_settings")
        .update({ is_popup_enabled: enabled })
        .eq("id", "global-settings");

    if (error) {
        alert("Failed to update popup setting: " + error.message);
    }
}

// ================= INIT =================
async function init() {
    // Safety Check: Ensure supabaseClient is defined (it's global now via 'var' in supabase-config.js)
    if (typeof window.supabaseClient === 'undefined') {
        console.error("🚨 Supabase Client is not defined! Ensure supabase-config.js is correctly included in HTML.");
        alert("Critical Error: Database connection not found. Please refresh the page.");
        return;
    }

    try {
        await checkAuth();
        console.log("✅ Admin Authenticated");
        // Sponsor functions are now globally defined below init()

        // ================= REAL-TIME BROADCAST (Phase 6) =================

        function broadcastMatchEvent(msg) {
            const channel = supabaseClient.channel('match-updates');
            channel.send({
                type: 'broadcast',
                event: 'live-alert',
                payload: { message: msg }
            });
        }

        // ================= REFINED NRR (Phase 5) =================

        async function syncPointsTableFromFixtures() {
            console.log("🔄 Recalculating Points Table (Refined NRR)...");

            const { data: fixtures } = await supabaseClient.from('fixtures').select('*').eq('status', 'completed');
            const { data: teams } = await supabaseClient.from('points_table').select('*');

            if (!fixtures || !teams) return;

            const stats = {};
            teams.forEach(t => {
                stats[t.team_name] = {
                    played: 0, won: 0, lost: 0, points: 0,
                    runs_scored: 0, overs_faced: 0, runs_conceded: 0, overs_bowled: 0
                };
            });

            fixtures.forEach(f => {
                const t1 = f.team1;
                const t2 = f.team2;
                if (!stats[t1] || !stats[t2]) return;

                stats[t1].played += 1;
                stats[t2].played += 1;

                // Sum Scores
                stats[t1].runs_scored += (f.t1_score || 0);
                stats[t1].runs_conceded += (f.t2_score || 0);
                stats[t2].runs_scored += (f.t2_score || 0);
                stats[t2].runs_conceded += (f.t1_score || 0);

                // NRR Logic (Full overs if all out)
                const getOvers = (runs, wickets, overs) => {
                    if (wickets >= 10) return 6.0; // Assume 6.0 overs if all out
                    return parseFloat(overs) || 6.0;
                };

                const o1 = getOvers(f.t1_score, f.t1_wickets, f.t1_overs);
                const o2 = getOvers(f.t2_score, f.t2_wickets, f.t2_overs);

                const o1_dec = Math.floor(o1) + ((o1 % 1) * 10 / 6);
                const o2_dec = Math.floor(o2) + ((o2 % 1) * 10 / 6);

                stats[t1].overs_faced += o1_dec;
                stats[t1].overs_bowled += o2_dec;
                stats[t2].overs_faced += o2_dec;
                stats[t2].overs_bowled += o1_dec;

                if (f.winner === t1) {
                    stats[t1].won += 1;
                    stats[t1].points += 2;
                    stats[t2].lost += 1;
                } else if (f.winner === t2) {
                    stats[t2].won += 1;
                    stats[t2].points += 2;
                    stats[t1].lost += 1;
                } else {
                    stats[t1].points += 1;
                    stats[t2].points += 1;
                }
            });

            for (const team of Object.keys(stats)) {
                const s = stats[team];
                const forRate = s.overs_faced > 0 ? (s.runs_scored / s.overs_faced) : 0;
                const againstRate = s.overs_bowled > 0 ? (s.runs_conceded / s.overs_bowled) : 0;
                const nrr = forRate - againstRate;

                await supabaseClient.from('points_table').update({
                    played: s.played,
                    won: s.won,
                    lost: s.lost,
                    points: s.points,
                    nrr: parseFloat(nrr.toFixed(3))
                }).eq('team_name', team);
            }
        }

        const tasks = [
            { name: "Hero", fn: loadHero },
            { name: "Registrations", fn: fetchRegistrations },
            { name: "Points", fn: fetchAdminPoints },
            { name: "Roster Teams", fn: loadRosterTeams },
            { name: "Settings", fn: loadSettings },
            { name: "Navigation Menu", fn: fetchAdminMenu },
            { name: "Team Dropdowns", fn: syncTeamDropdowns },
            { name: "Sponsors", fn: fetchSponsors },
            { name: "Gallery", fn: fetchGallery }
        ];

        for (const task of tasks) {
            try {
                await task.fn();
                console.log(`✅ Loaded ${task.name}`);
            } catch (err) {
                console.error(`❌ Failed to load ${task.name}:`, err);
            }
        }
    } catch (err) {
        console.error("🚨 Auth check failed:", err);
    }
}

init();
showSection('registrations');

// ================= ANALYTICS & CHARTS =================
let regChart = null;
let budgetChart = null;

async function loadAnalytics() {
    console.log("📊 Loading Analytics...");

    // 1. Fetch Counts
    const { data: regs } = await supabaseClient.from('player_registrations').select('id, payment_status, status');
    const total = regs.length;
    const paid = regs.filter(r => r.payment_status === 'completed' || r.payment_status === 'paid').length; // Changed 'Paid' to 'paid' for consistency
    const sold = regs.filter(r => r.status === 'sold').length;
    const unsold = regs.filter(r => r.status === 'unsold').length;

    document.getElementById('count-total').innerText = total;
    document.getElementById('count-paid').innerText = paid;
    document.getElementById('count-sold').innerText = sold;
    document.getElementById('count-unsold').innerText = unsold;

    // 2. Render Registration Chart
    renderRegChart(paid, total - paid);

    // 3. Fetch Budget Data
    const { data: teams } = await supabaseClient.from('points_table').select('team_name, budget, spent_points'); // Changed total_points to budget
    if (teams) {
        renderBudgetChart(teams);
    }
}

function renderRegChart(paid, unpaid) {
    const ctx = document.getElementById('regChart').getContext('2d');
    if (regChart) regChart.destroy();

    regChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Paid', 'Pending'],
            datasets: [{
                data: [paid, unpaid],
                backgroundColor: ['#22c55e', '#ff0055'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#a0a0c0', font: { family: 'Outfit' } } }
            }
        }
    });
}

function renderBudgetChart(teams) {
    const ctx = document.getElementById('budgetChart').getContext('2d');
    if (budgetChart) budgetChart.destroy();

    budgetChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: teams.map(t => t.team_name),
            datasets: [
                {
                    label: 'Spent',
                    data: teams.map(t => t.spent_points),
                    backgroundColor: '#ff0055',
                    borderRadius: 5
                },
                {
                    label: 'Remaining',
                    data: teams.map(t => t.budget - t.spent_points), // Changed total_points to budget
                    backgroundColor: '#00f2ff',
                    borderRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, grid: { display: false }, ticks: { color: '#a0a0c0' } },
                y: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a0a0c0' } }
            },
            plugins: {
                legend: { position: 'bottom', labels: { color: '#a0a0c0', font: { family: 'Outfit' } } }
            }
        }
    });
}

// ================= PDF EXPORT =================
async function exportResultsPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // 1. Fetch Data
    const { data: soldPlayers } = await supabaseClient
        .from('team_players')
        .select('*')
        .order('team_name', { ascending: true });

    const { data: teams } = await supabaseClient
        .from('points_table')
        .select('*')
        .order('budget', { ascending: false });

    // 2. Title & Header
    doc.setFontSize(22);
    doc.setTextColor(255, 0, 85); // Primary Pink
    doc.text("SATPL 2026 AUCTION REPORT", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

    // 3. Team Summary Table
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Team Budget Summary", 14, 40);

    const teamRows = (teams || []).map(t => [
        t.team_name,
        `₹${t.budget.toLocaleString()}`,
        `₹${t.spent_points.toLocaleString()}`,
        `₹${(t.budget - t.spent_points).toLocaleString()}`
    ]);

    doc.autoTable({
        startY: 45,
        head: [['Team Name', 'Total Budget', 'Spent', 'Remaining']],
        body: teamRows,
        theme: 'striped',
        headStyles: { fillColor: [0, 242, 255], textColor: [0, 0, 0] }
    });

    // 4. Sold Players Table
    const finalY = doc.lastAutoTable.finalY + 15;
    doc.text("Sold Players List", 14, finalY);

    const playerRows = (soldPlayers || []).map(p => [
        p.player_name,
        p.team_name,
        `₹${(p.bid_amount || 0).toLocaleString()}`
    ]);

    doc.autoTable({
        startY: finalY + 5,
        head: [['Player Name', 'Sold To Team', 'Final Price']],
        body: playerRows,
        theme: 'grid',
        headStyles: { fillColor: [255, 0, 85] }
    });

    // 5. Save
    doc.save(`SATPL_Auction_Report_${Date.now()}.pdf`);
}

// ================= SMART SQUAD (FUTURE USE) =================
/* ... remaining functions ... */
async function getPlayerByRegNo(regNo) {
    if (!regNo) return null;
    const { data, error } = await supabaseClient
        .from("player_registrations")
        .select("player_name, batting, bowling, wicket_keeper")
        .eq("registration_no", regNo.trim().toUpperCase())
        .single();
    if (error) {
        console.warn("Smart Squad Lookup Error:", error.message);
        return null;
    }
    return data;
}

async function handleSquadRegNoInput(input) {
    const regNo = input.value.trim().toUpperCase();
    if (regNo.length < 10) return;

    const player = await getPlayerByRegNo(regNo);
    if (player) {
        const row = input.closest('tr');
        if (row) {
            const nameInput = row.querySelector('.player-name');
            const formatSelect = row.querySelector('.player-format');
            const wkCheckbox = row.querySelector('.player-wk');

            if (nameInput) nameInput.value = player.player_name;
            if (formatSelect) {
                let format = "Allrounder";
                if (player.batting !== 'no' && player.bowling === 'no') format = "Batting";
                else if (player.batting === 'no' && player.bowling !== 'no') format = "Bowling";
                formatSelect.value = format;
            }
            if (wkCheckbox) wkCheckbox.checked = (player.wicket_keeper === 'yes' || player.wicket_keeper === true);
            input.style.borderColor = "var(--secondary)";
        }
    } else {
        input.style.borderColor = "#ff4d8d";
    }
}

// ================= ANNOUNCEMENTS (NOTICES) =================
async function fetchNotices() {
    const [noticesRes, settingsRes] = await Promise.all([
        window.safeSupabaseCall(() =>
            supabaseClient.from('notices').select('*').order('created_at', { ascending: false })
        ),
        window.safeSupabaseCall(() =>
            supabaseClient.from('site_settings').select('featured_notice_id').eq('id', 'global-settings').single()
        )
    ]);

    if (noticesRes.error) {
        console.error("Error fetching notices:", noticesRes.error.message);
        return;
    }
    const notices = noticesRes.data;

    if (settingsRes.error) {
        console.error("Error fetching site settings for featured notice:", settingsRes.error.message);
        // Continue without featured notice if settings fetch fails
    }
    const settings = settingsRes.data;

    const list = document.getElementById('admin-notices-list');
    if (!list) return;

    const featuredId = settings ? settings.featured_notice_id : null;

    list.innerHTML = notices.map(notice => {
        const date = new Date(notice.created_at).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
        const isPinned = notice.id === featuredId;

        return `
            <tr style="${isPinned ? 'border-left: 4px solid var(--secondary);' : ''}">
                <td>${date}</td>
                <td style="font-weight: 700;">
                    ${notice.title}
                    ${isPinned ? '<span style="font-size: 0.7rem; color: var(--secondary); margin-left: 8px;">📌 PINNED</span>' : ''}
                </td>
                <td style="font-size: 0.85rem; color: var(--text-dim);">${notice.content ? notice.content.substring(0, 50) + '...' : '-'}</td>
                <td>
                    <span class="status-badge ${notice.is_active ? 'paid' : 'pending'}" 
                          onclick="toggleNoticeStatus('${notice.id}', ${notice.is_active})" 
                          style="cursor: pointer;">
                        ${notice.is_active ? 'Active' : 'Archived'}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="btn" style="padding: 5px 12px; font-size: 0.75rem; background: ${isPinned ? 'var(--secondary)' : '#3b82f6'};" onclick="editNotice('${notice.id}')">Edit</button>
                        <button class="btn" style="padding: 5px 12px; font-size: 0.75rem; background: ${isPinned ? 'var(--text-dim)' : 'var(--secondary)'};" onclick="setFeaturedNotice('${notice.id}', ${isPinned})">
                            ${isPinned ? 'Unpin' : 'Pin to Popup'}
                        </button>
                        <button class="btn-secondary" style="padding: 5px 10px; background: #ef4444; border: none; font-size: 0.75rem;" onclick="deleteNotice('${notice.id}')">Del</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function openNoticeModal(isEdit = false) {
    document.getElementById('notice-modal-title').innerText = isEdit ? 'Edit Announcement' : 'Add New Announcement';
    if (!isEdit) {
        document.getElementById('edit-notice-id').value = '';
        document.getElementById('notice-title').value = '';
        document.getElementById('notice-content').value = '';
    }
    document.getElementById('notice-modal').style.display = 'flex';
}

function closeNoticeModal() {
    document.getElementById('notice-modal').style.display = 'none';
}

async function editNotice(id) {
    const { data, error } = await window.safeSupabaseCall(() =>
        supabaseClient
            .from('notices')
            .select('*')
            .eq('id', id)
            .single()
    );
    if (data) {
        document.getElementById('edit-notice-id').value = data.id;
        document.getElementById('notice-title').value = data.title;
        document.getElementById('notice-content').value = data.content || '';
        openNoticeModal(true);
    }
}

async function saveNotice(event) {
    event.preventDefault();
    const id = document.getElementById('edit-notice-id').value;
    const title = document.getElementById('notice-title').value;
    const content = document.getElementById('notice-content').value;
    const noticeData = { title, content };

    let result;
    if (id) {
        result = await window.safeSupabaseCall(() =>
            supabaseClient.from('notices').update(noticeData).eq('id', id)
        );
    } else {
        result = await window.safeSupabaseCall(() =>
            supabaseClient.from('notices').insert([noticeData])
        );
    }

    if (result.error) alert(result.error.message);
    else {
        alert(id ? "✅ Updated!" : "✅ Published!");
        closeNoticeModal();
        fetchNotices();
    }
}

async function setFeaturedNotice(id, isUnpin) {
    const newId = isUnpin ? null : id;
    const { error } = await window.safeSupabaseCall(() =>
        supabaseClient
            .from('site_settings')
            .update({ featured_notice_id: newId })
            .eq('id', 'global-settings')
    );

    if (error) alert("Error pinning notice: " + error.message);
    else {
        alert(isUnpin ? "📌 Notice Unpinned!" : "📌 Notice Pinned to Popup!");
        fetchNotices();
    }
}

async function toggleNoticeStatus(id, current) {
    await window.safeSupabaseCall(() =>
        supabaseClient.from('notices').update({ is_active: !current }).eq('id', id)
    );
    fetchNotices();
}

async function deleteNotice(id) {
    if (!confirm("Are you sure?")) return;
    await window.safeSupabaseCall(() =>
        supabaseClient.from('notices').delete().eq('id', id)
    );
    fetchNotices();
}

// ================= FIXTURES (SCHEDULE) =================
async function fetchFixtures() {
    const { data, error } = await window.safeSupabaseCall(() =>
        supabaseClient.from('fixtures').select('*').order('match_no', { ascending: true })
    );
    if (error) return;
    const list = document.getElementById('admin-fixtures-list');
    if (!list) return;

    list.innerHTML = data.map(f => {
        const date = new Date(f.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const fixtureJson = JSON.stringify(f).replace(/'/g, "&apos;");
        return `
            <tr>
                <td>${f.match_no}</td>
                <td style="font-size: 0.9rem;"><strong>${date}</strong> | ${f.match_time.substring(0, 5)}</td>
                <td style="font-weight: 700;">${f.team1} <span style="color: var(--text-dim);">vs</span> ${f.team2}</td>
                <td style="font-size: 0.85rem;">${f.venue}</td>
                <td>
                    <span class="status-badge ${f.status === 'completed' ? 'paid' : 'pending'}" onclick="toggleFixtureStatus('${f.id}', '${f.status}')" style="cursor: pointer;">
                        ${f.status.toUpperCase()}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-secondary" onclick='editFixture(${fixtureJson})'>EDIT</button>
                        <button class="btn" style="background: var(--primary);" onclick="startLiveMatch('${f.id}')">Start LIVE 🏏</button>
                        <button class="btn-secondary" style="border-color: #ff4d8d; color: #ff4d8d;" onclick="deleteFixture('${f.id}')">DEL</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function autoGenerateFixtures() {
    try {
        if (!confirm("Are you sure you want to auto-generate 10 league matches for 5 teams?")) return;

        // 1. Fetch Teams
        const { data: teams, error } = await supabaseClient
            .from('points_table')
            .select('team_name')
            .order('id');

        if (error || !teams || teams.length < 5) {
            alert("Found teams: " + (teams ? teams.length : 0));
            return alert("Error: Please make sure you have at least 5 teams in the Points Table first.");
        }

        const T = teams.map(t => t.team_name);

        // 5 Teams Round Robin with Byes (Standard Schedule)
        const matches = [
            { no: 1, t1: T[0], t2: T[1], venue: 'Sonaijuri Ground' }, // Bye T5
            { no: 2, t1: T[2], t2: T[3], venue: 'Sonaijuri Ground' },

            { no: 3, t1: T[0], t2: T[2], venue: 'Sonaijuri Ground' }, // Bye T4
            { no: 4, t1: T[1], t2: T[4], venue: 'Sonaijuri Ground' },

            { no: 5, t1: T[0], t2: T[3], venue: 'Sonaijuri Ground' }, // Bye T2
            { no: 6, t1: T[2], t2: T[4], venue: 'Sonaijuri Ground' },

            { no: 7, t1: T[0], t2: T[4], venue: 'Sonaijuri Ground' }, // Bye T3
            { no: 8, t1: T[1], t2: T[3], venue: 'Sonaijuri Ground' },

            { no: 9, t1: T[1], t2: T[2], venue: 'Sonaijuri Ground' }, // Bye T1
            { no: 10, t1: T[3], t2: T[4], venue: 'Sonaijuri Ground' }
        ];

        // 2. Insert into Fixtures
        const fixtureInserts = matches.map(m => ({
            match_no: m.no,
            team1: m.t1,
            team2: m.t2,
            venue: m.venue,
            status: 'upcoming',
            match_date: new Date().toISOString().split('T')[0], // Default today
            match_time: '10:00 AM'
        }));

        const { error: insertError } = await supabaseClient.from('fixtures').insert(fixtureInserts);

        if (insertError) {
            alert("Error generating fixtures: " + insertError.message);
        } else {
            console.log("Fixtures generated successfully!");
            if (window.showToast) {
                window.showToast("✅ 10 League Matches Generated!", "success");
            } else {
                alert("✅ 10 League Matches Generated!");
            }
            fetchFixtures();
        }
    } catch (err) {
        console.error("CRITICAL FIXTURE ERROR:", err);
        alert("CRITICAL ERROR: " + err.message + "\nStack: " + err.stack);
    }
}

async function openFixtureModal(isEdit = false) {
    document.getElementById('fixture-modal-title').innerText = isEdit ? 'Edit Match 🏏' : 'Add New Match 🏏';

    // Fetch teams for dropdowns
    const t1Select = document.getElementById('fix-t1');
    const t2Select = document.getElementById('fix-t2');

    const { data: teams } = await window.safeSupabaseCall(() =>
        supabaseClient.from('points_table').select('team_name').order('team_name')
    );
    if (teams) {
        const options = '<option value="">Select Team</option>' +
            teams.map(t => `<option value="${t.team_name}">${t.team_name}</option>`).join('');
        t1Select.innerHTML = options;
        t2Select.innerHTML = options;
    }

    if (!isEdit) {
        document.getElementById('edit-fixture-id').value = '';
        document.getElementById('fix-no').value = '';
        document.getElementById('fix-date').value = '';
        document.getElementById('fix-time').value = '';
        document.getElementById('fix-t1').value = '';
        document.getElementById('fix-t2').value = '';
        document.getElementById('fix-venue').value = 'Sonaijuri Cricket Ground';
    }
    document.getElementById('fixture-modal').style.display = 'flex';
}

function closeFixtureModal() {
    document.getElementById('fixture-modal').style.display = 'none';
}

function editFixture(f) {
    document.getElementById('edit-fixture-id').value = f.id;
    if (f.status === 'completed') {
        openResultModal(f.id, f.team1, f.team2);
        return;
    }
    document.getElementById('fix-no').value = f.match_no;
    document.getElementById('fix-date').value = f.match_date;
    document.getElementById('fix-time').value = f.match_time;
    document.getElementById('fix-t1').value = f.team1;
    document.getElementById('fix-t2').value = f.team2;
    document.getElementById('fix-venue').value = f.venue;
    document.getElementById('fix-status').value = f.status;
    openFixtureModal(true);
}

async function saveFixture(event) {
    event.preventDefault();
    const id = document.getElementById('edit-fixture-id').value;
    const updates = {
        match_no: Number(document.getElementById('fix-no').value),
        match_date: document.getElementById('fix-date').value,
        match_time: document.getElementById('fix-time').value,
        team1: document.getElementById('fix-t1').value,
        team2: document.getElementById('fix-t2').value,
        venue: document.getElementById('fix-venue').value,
        status: document.getElementById('fix-status').value
    };

    let res;
    if (id) {
        res = await window.safeSupabaseCall(() =>
            supabaseClient.from('fixtures').update(updates).eq('id', id)
        );
    } else {
        res = await window.safeSupabaseCall(() =>
            supabaseClient.from('fixtures').insert([updates])
        );
    }
    const { error } = res;

    if (error) {
        alert("Error: " + error.message);
    } else {
        logActivity('Fixture', `${id ? 'Updated' : 'Added'} Match #${updates.match_no}`);
        closeFixtureModal();
        fetchFixtures();
    }
}

async function toggleFixtureStatus(id, current) {
    if (current === 'upcoming') {
        const { data: match } = await window.safeSupabaseCall(() =>
            supabaseClient.from('fixtures').select('*').eq('id', id).single()
        );
        if (match) {
            openResultModal(id, match.team1, match.team2);
        }
    } else {
        const next = 'upcoming';
        await supabaseClient.from('fixtures').update({ status: next }).eq('id', id);
        logActivity('Fixture', `Match status changed for match ID: ${id}`);
        fetchFixtures();
    }
}

async function deleteFixture(id) {
    if (!confirm("Are you sure?")) return;
    await supabaseClient.from('fixtures').delete().eq('id', id);
    fetchFixtures();
}

async function fetchResults() {
    const { data, error } = await supabaseClient.from('fixtures').select('*').eq('status', 'completed').order('match_no', { ascending: false });
    if (error) return;
    const list = document.getElementById('admin-results-list');
    if (!list) return;

    if (!data || data.length === 0) {
        list.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-dim);">No completed matches in results yet. Finalize a match to see it here.</td></tr>`;
        return;
    }

    list.innerHTML = data.map(f => `
        <tr>
            <td style="font-weight: 800; color: var(--secondary);">#${f.match_no}</td>
            <td>
                <div style="display: flex; flex-direction: column;">
                    <span style="font-weight: 700;">${f.team1} vs ${f.team2}</span>
                    <span style="font-size: 0.75rem; color: var(--text-dim);">${f.match_date} • ${f.venue}</span>
                </div>
            </td>
            <td>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <span style="background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px; font-weight: 700;">${f.t1_score}/${f.t1_wickets || 0}</span>
                    <span style="color: var(--text-dim); font-size: 0.7rem;">-</span>
                    <span style="background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px; font-weight: 700;">${f.t2_score}/${f.t2_wickets || 0}</span>
                </div>
            </td>
            <td>
                <span style="background: rgba(0, 242, 255, 0.1); color: var(--secondary); padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 800;">
                    ${f.winner === 'Draw' ? 'NO RESULT' : (f.winner ? f.winner.toUpperCase() : 'N/A')}
                </span>
            </td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <button class="btn" style="padding: 6px 12px; font-size: 0.7rem; background: #3b82f6;" onclick="openResultModal('${f.id}', '${f.team1}', '${f.team2}')">EDIT</button>
                    <button class="btn-secondary" style="padding: 6px 12px; font-size: 0.7rem; border-color: #ef4444; color: #ef4444;" onclick="deleteFixture('${f.id}')">DEL</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ================= LEADERBOARD (STATS) =================
async function fetchLeaderboard() {
    const { data, error } = await supabaseClient.from('top_performers').select('*').order('category', { ascending: true }).order('runs', { ascending: false }).order('wickets', { ascending: false });
    if (error) return;
    const list = document.getElementById('admin-leaderboard-list');
    if (!list) return;

    list.innerHTML = data.map(p => `
        <tr>
            <td style="font-weight: 700;">${p.player_name}</td>
            <td>${p.team_name || '-'}</td>
            <td><span class="status-badge ${p.category === 'batsman' ? 'paid' : 'pending'}">${p.category.toUpperCase()}</span></td>
            <td style="font-weight: 800; color: var(--secondary);">${p.category === 'batsman' ? p.runs + ' Runs' : p.wickets + ' Wkts'}</td>
            <td>
                <div style="display: flex; gap: 5px;">
                    <button class="btn" style="background: #3b82f6; padding: 5px 10px; font-size: 0.75rem;" onclick='editLeaderboard(${JSON.stringify(p)})'>Edit</button>
                    <button class="btn-secondary" style="background: #ef4444; border: none; padding: 5px 10px;" onclick="deleteLeaderboard('${p.id}')">Del</button>
                </div>
            </td>
        </tr>
        `).join('');
}

function openLeaderboardModal(isEdit = false) {
    document.getElementById('leaderboard-modal-title').innerText = isEdit ? 'Edit Performance 🏆' : 'New Performance Entry 🏆';
    if (!isEdit) {
        document.getElementById('edit-leaderboard-id').value = '';
        document.getElementById('stat-lookup-reg').value = '';
        document.getElementById('stat-name').value = '';
        document.getElementById('stat-team').value = '';
        document.getElementById('stat-value').value = 0;
    }
    document.getElementById('leaderboard-modal').style.display = 'flex';
}

function closeLeaderboardModal() {
    document.getElementById('leaderboard-modal').style.display = 'none';
}

function editLeaderboard(p) {
    document.getElementById('edit-leaderboard-id').value = p.id;
    document.getElementById('stat-lookup-reg').value = '';
    document.getElementById('stat-name').value = p.player_name;
    document.getElementById('stat-team').value = p.team_name || '';
    document.getElementById('stat-category').value = p.category;
    document.getElementById('stat-value').value = p.category === 'batsman' ? p.runs : p.wickets;
    openLeaderboardModal(true);
}

async function lookupPlayerForStat() {
    const regNo = document.getElementById('stat-lookup-reg').value.trim().toUpperCase();
    if (!regNo) return alert("Please enter a Registration Number!");

    const fetchBtn = event.target;
    const originalText = fetchBtn.innerText;
    fetchBtn.innerText = "⏳...";
    fetchBtn.disabled = true;

    try {
        // 1. First search in player_registrations to get the official name
        const { data: regData, error: regErr } = await window.safeSupabaseCall(() =>
            supabaseClient
                .from('player_registrations')
                .select('player_name')
                .eq('registration_no', regNo)
                .single()
        );

        if (regErr || !regData) {
            alert("No player found with this Registration ID!");
            return;
        }

        document.getElementById('stat-name').value = regData.player_name;

        // 2. Search in team_players to get their Team Name
        const { data: teamPlayerData, error: teamErr } = await window.safeSupabaseCall(() =>
            supabaseClient
                .from('team_players')
                .select('team_id')
                .eq('reg_no', regNo)
                .single()
        );

        if (teamErr) {
            console.error("Lookup team player error:", teamErr);
            if (window.isNetworkError(teamErr)) {
                const health = await window.testSupabaseConnection();
                alert(health.detailed);
            }
            // Don't return, as team info is optional, just log error
        }

        if (teamPlayerData && teamPlayerData.team_id) {
            const { data: teamData, error: teamNameErr } = await window.safeSupabaseCall(() =>
                supabaseClient
                    .from('points_table')
                    .select('team_name')
                    .eq('id', teamPlayerData.team_id)
                    .single()
            );

            if (teamNameErr) {
                console.error("Lookup team name error:", teamNameErr);
                if (window.isNetworkError(teamNameErr)) {
                    const health = await window.testSupabaseConnection();
                    alert(health.detailed);
                }
                // Don't return, as team info is optional, just log error
            }

            if (teamData) {
                document.getElementById('stat-team').value = teamData.team_name;
            }
        } else {
            document.getElementById('stat-team').value = "Independent / No Team";
        }

        showToast("Player details fetched!", "success");

    } catch (e) {
        console.error("Lookup error:", e);
    } finally {
        fetchBtn.innerText = originalText;
        fetchBtn.disabled = false;
    }
}

async function saveLeaderboard(event) {
    event.preventDefault();
    const id = document.getElementById('edit-leaderboard-id').value;
    const cat = document.getElementById('stat-category').value;
    const updates = {
        player_name: document.getElementById('stat-name').value,
        team_name: document.getElementById('stat-team').value,
        category: cat,
        runs: cat === 'batsman' ? Number(document.getElementById('stat-value').value) : 0,
        wickets: cat === 'bowler' ? Number(document.getElementById('stat-value').value) : 0
    };

    let error;
    if (id) {
        const res = await window.safeSupabaseCall(() =>
            supabaseClient.from('top_performers').update(updates).eq('id', id)
        );
        error = res.error;
    } else {
        const res = await window.safeSupabaseCall(() =>
            supabaseClient.from('top_performers').insert([updates])
        );
        error = res.error;
    }

    if (error) {
        alert("Error: " + error.message);
    } else {
        logActivity('Leaderboard', `${id ? 'Updated' : 'Added'} stats for ${updates.player_name}`);
        closeLeaderboardModal();
        fetchLeaderboard();
    }
}

async function deleteLeaderboard(id) {
    if (!confirm("Are you sure?")) return;
    const { error } = await window.safeSupabaseCall(() =>
        supabaseClient.from('top_performers').delete().eq('id', id)
    );
    if (error) {
        console.error("Error deleting leaderboard entry:", error);
        alert("Error deleting leaderboard entry: " + error.message);
    } else {
        fetchLeaderboard();
    }
}

// ================= GALLERY MANAGER =================
async function fetchGallery() {
    console.log("📸 Fetching Gallery Photos...");
    const list = document.getElementById('admin-gallery-list');
    if (!list) return;

    const { data, error } = await window.safeSupabaseCall(() =>
        supabaseClient
            .from('gallery')
            .select('*')
            .order('created_at', { ascending: false })
    );

    if (error) {
        console.error("Gallery Fetch Error:", error.message);
        return;
    }

    list.innerHTML = data.map(photo => `
        <tr>
            <td>
                <img src="${photo.image_url}" style="width: 80px; height: 50px; object-fit: cover; border-radius: 8px; border: 1px solid var(--glass-border);">
            </td>
            <td style="font-size: 0.8rem; color: var(--text-dim); max-width: 200px; overflow: hidden; text-overflow: ellipsis;">
                ${photo.image_url}
            </td>
            <td style="font-size: 0.85rem;">${new Date(photo.created_at).toLocaleDateString()}</td>
            <td><span class="status-badge ${photo.orientation === 'landscape' ? 'paid' : 'pending'}">${photo.orientation?.toUpperCase() || 'LANDSCAPE'}</span></td>
            <td>
                <div style="display: flex; gap: 5px;">
                    <button class="btn-secondary" style="background: var(--secondary); color: var(--bg-dark); border: none; padding: 5px 10px;" onclick='editGalleryPhoto(${JSON.stringify(photo)})'>Edit</button>
                    <button class="btn-secondary" style="background: #ef4444; border: none; padding: 5px 10px;" onclick="deleteGalleryPhoto('${photo.id}', '${photo.image_url}')">Del</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openGalleryModal(isEdit = false) {
    document.getElementById('gallery-modal-title').innerText = isEdit ? "Edit Photo Alignment" : "Add Gallery Photo";
    document.getElementById('edit-gallery-id').value = isEdit ? currentEditingPhotoId || "" : "";

    if (!isEdit) {
        document.getElementById('gallery-photo-input').value = '';
        document.getElementById('gallery-link-input').value = '';
        document.getElementById('gallery-photo-preview').innerHTML = '<span style="color: var(--text-dim); font-size: 0.8rem;">Photo Preview</span>';
        galleryPhotoFile = null;
        switchGalleryTab('upload');
    }
    document.getElementById('gallery-modal').style.display = 'flex';
}

let currentEditingPhotoId = null;
let currentEditingPhotoUrl = null;
function editGalleryPhoto(photo) {
    currentEditingPhotoId = photo.id;
    currentEditingPhotoUrl = photo.image_url;
    openGalleryModal(true);

    // Set orientation
    document.querySelector(`input[name = "gallery-orientation"][value = "${photo.orientation || 'landscape'}"]`).checked = true;

    // Show preview of existing
    document.getElementById('gallery-photo-preview').innerHTML = `<img src="${photo.image_url}" style="max-width: 100%; max-height: 200px; border-radius: 8px;">`;

    // Show all tabs so user can change the photo
    document.querySelector('.filter-tabs').style.display = 'flex';
    document.getElementById('gallery-upload-area').style.display = 'block';
    document.getElementById('gallery-link-area').style.display = 'none';
    switchGalleryTab('upload');

    document.getElementById('gallerySubmitBtn').innerText = "Update Photo & Alignment 💾";
}

// Update openGalleryModal to show tabs again when adding
function openAddGalleryModal() {
    document.querySelector('.filter-tabs').style.display = 'flex';
    document.getElementById('gallery-upload-area').style.display = 'block';
    document.getElementById('gallerySubmitBtn').innerText = "Upload Photo 📸";
    openGalleryModal(false);
}

function closeGalleryModal() {
    document.getElementById('gallery-modal').style.display = 'none';
}

let activeGalleryTab = 'upload';
function switchGalleryTab(tab) {
    activeGalleryTab = tab;
    document.getElementById('tab-upload').classList.toggle('active', tab === 'upload');
    document.getElementById('tab-link').classList.toggle('active', tab === 'link');
    document.getElementById('gallery-upload-area').style.display = tab === 'upload' ? 'block' : 'none';
    document.getElementById('gallery-link-area').style.display = tab === 'link' ? 'block' : 'none';

    // Clear other input
    if (tab === 'upload') document.getElementById('gallery-link-input').value = '';
    else {
        document.getElementById('gallery-photo-input').value = '';
        galleryPhotoFile = null;
        document.getElementById('gallery-photo-preview').innerHTML = '<span style="color: var(--text-dim); font-size: 0.8rem;">Photo Preview</span>';
    }
}

let galleryPhotoFile = null;
function handleGalleryUpload(input) {
    const previewEl = document.getElementById('gallery-photo-preview');
    if (input.files && input.files[0]) {
        galleryPhotoFile = input.files[0];
        const reader = new FileReader();
        reader.onload = function (e) {
            previewEl.innerHTML = `<img src="${e.target.result}" style="max-width: 100%; max-height: 200px; border-radius: 8px;">`;
        };
        reader.readAsDataURL(galleryPhotoFile);
    }
}

async function saveGalleryPhoto(event) {
    event.preventDefault();

    let imageUrl = "";
    const btn = document.getElementById('gallerySubmitBtn');
    const originalText = btn.innerText;
    const orientation = document.querySelector('input[name="gallery-orientation"]:checked').value;
    const editId = document.getElementById('edit-gallery-id').value;

    if (!editId) {
        if (activeGalleryTab === 'upload') {
            if (!galleryPhotoFile) return alert("Select a photo first!");
        } else {
            imageUrl = document.getElementById('gallery-link-input').value.trim();
            if (!imageUrl) return alert("Enter image URL first!");
        }
    }
    btn.disabled = true;
    btn.innerText = "⏳ Uploading...";

    try {
        if (!editId) {
            // --- ADD NEW PHOTO ---
            if (activeGalleryTab === 'upload') {
                const timestamp = Date.now();
                const ext = galleryPhotoFile.name.split('.').pop();
                const fileName = `gallery_${timestamp}.${ext} `;

                const { data: uploadData, error: uploadError } = await supabaseClient.storage
                    .from('player-photos')
                    .upload(fileName, galleryPhotoFile);

                if (uploadError) throw uploadError;

                const { data: publicUrlData } = supabaseClient.storage
                    .from('player-photos')
                    .getPublicUrl(fileName);

                imageUrl = publicUrlData.publicUrl;
            }

            const { error: dbError } = await window.safeSupabaseCall(() =>
                supabaseClient
                    .from('gallery')
                    .insert([{
                        image_url: imageUrl,
                        orientation: orientation
                    }])
            );

            if (dbError) throw dbError;
            alert("✅ Photo added to gallery!");
        } else {
            // --- EDIT EXISTING PHOTO ---
            let updates = { orientation: orientation };

            // Check if user provided a new image
            if (activeGalleryTab === 'upload' && galleryPhotoFile) {
                const timestamp = Date.now();
                const ext = galleryPhotoFile.name.split('.').pop();
                const fileName = `gallery_${timestamp}.${ext} `;

                const { data: uploadData, error: uploadError } = await supabaseClient.storage
                    .from('player-photos')
                    .upload(fileName, galleryPhotoFile);

                if (uploadError) throw uploadError;

                const { data: publicUrlData } = supabaseClient.storage
                    .from('player-photos')
                    .getPublicUrl(fileName);

                updates.image_url = publicUrlData.publicUrl;
            } else if (activeGalleryTab === 'link' && document.getElementById('gallery-link-input').value.trim()) {
                updates.image_url = document.getElementById('gallery-link-input').value.trim();
            }

            const { error: dbError } = await window.safeSupabaseCall(() =>
                supabaseClient
                    .from('gallery')
                    .update(updates)
                    .eq('id', editId)
            );

            if (dbError) throw dbError;
            alert("✅ Gallery item updated successfully!");
        }

        closeGalleryModal();
        fetchGallery();
    } catch (err) {
        alert("❌ Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

async function deleteGalleryPhoto(id, url) {
    if (!confirm("Remove this photo from gallery?")) return;

    try {
        // 1. Delete from DB
        const { error: dbError } = await supabaseClient.from('gallery').delete().eq('id', id);
        if (dbError) throw dbError;

        // 2. Try to delete from storage if it's our URL
        if (url.includes('player-photos')) {
            const fileName = url.split('/').pop();
            await supabaseClient.storage.from('player-photos').remove([fileName]);
        }
        fetchGallery();
    } catch (err) {
        alert("Error deleting: " + err.message);
    }
}

// ================= ADMIN ACTIVITY & DASHBOARD =================
async function logActivity(type, description) {
    try {
        await supabaseClient.from('admin_activity').insert([{
            action_type: type,
            description: description,
            admin_name: 'Admin'
        }]);
    } catch (e) { console.warn("Logging failed:", e); }
}

async function loadDashboard() {
    const activityFeed = document.getElementById('activity-feed');
    const statsReg = document.getElementById('stat-reg-count');
    const statsPaid = document.getElementById('stat-paid-count');

    // 1. Load Stats
    const { count: total } = await supabaseClient.from('player_registrations').select('*', { count: 'exact', head: true });
    const { count: paid } = await supabaseClient.from('player_registrations').select('*', { count: 'exact', head: true }).eq('payment_status', 'paid');

    if (statsReg) statsReg.innerText = total || 0;
    if (statsPaid) statsPaid.innerText = paid || 0;

    // 2. Load Activity
    const { data: activities, error } = await supabaseClient
        .from('admin_activity')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error || !activities || activities.length === 0) {
        activityFeed.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-dim);">No recent activity.</div>';
        return;
    }

    activityFeed.innerHTML = activities.map(act => `
        <div style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; gap: 10px; align-items: center;">
            <div style="background: var(--secondary); color: var(--bg-dark); padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase;">${act.action_type}</div>
            <div style="flex: 1;">
                <div style="font-size: 0.85rem; color: white;">${act.description}</div>
                <div style="font-size: 0.7rem; color: var(--text-dim);">${new Date(act.created_at).toLocaleString()}</div>
            </div>
        </div>
    `).join('');
}

// ================= MATCH RESULT MODAL =================
window.openResultModal = async function (id, t1, t2) {
    document.getElementById('result-match-id').value = id;
    document.getElementById('result-t1-name').value = t1;
    document.getElementById('result-t2-name').value = t2;
    document.getElementById('res-t1-label').innerText = t1;
    document.getElementById('res-t2-label').innerText = t2;

    // Fetch existing data if any
    const { data: m } = await supabaseClient.from('fixtures').select('*').eq('id', id).single();
    if (m) {
        document.getElementById('res-t1-runs').value = m.t1_score || 0;
        document.getElementById('res-t1-overs').value = m.t1_overs || 6.0;
        document.getElementById('res-t1-wkts').value = m.t1_wickets || 0;
        document.getElementById('res-t2-runs').value = m.t2_score || 0;
        document.getElementById('res-t2-overs').value = m.t2_overs || 6.0;
        document.getElementById('res-t2-wkts').value = m.t2_wickets || 0;

        // Load top performers if they exist
        if (document.getElementById('res-top-bat')) {
            document.getElementById('res-top-bat').value = m.top_bat || "";
            document.getElementById('res-top-bat-runs').value = m.top_bat_runs || 0;
            document.getElementById('res-top-bowl').value = m.top_bowl || "";
            document.getElementById('res-top-bowl-wkts').value = m.top_bowl_wkts || 0;
        }

        // Pre-fill top performers from live scoring state if it's the current live match
        if (m.status === 'upcoming' && liveMatchState.team_name) {
            // Simple heuristic: fill current batsman1 and bowler
            document.getElementById('res-top-bat').value = liveMatchState.batsman1.name || '';
            document.getElementById('res-top-bat-runs').value = liveMatchState.batsman1.runs || 0;
            document.getElementById('res-top-bowl').value = liveMatchState.bowler.name || '';
            document.getElementById('res-top-bowl-wkts').value = liveMatchState.bowler.wkts || 0;
        }

        // Fill winner options
        const winnerSelect = document.getElementById('res-winner');
        winnerSelect.innerHTML = `
        <option value="${t1}">${t1}</option>
        <option value="${t2}">${t2}</option>
        <option value="Draw">Draw/No Result</option>
    `;
        if (m && m.winner) winnerSelect.value = m.winner;

        document.getElementById('result-modal').style.display = 'flex';
    }
}

window.closeResultModal = function () {
    document.getElementById('result-modal').style.display = 'none';
}

window.submitMatchResult = async function () {
    const id = document.getElementById('result-match-id').value;
    const t1 = document.getElementById('result-t1-name').value;
    const t2 = document.getElementById('result-t2-name').value;
    const r1 = parseInt(document.getElementById('res-t1-runs').value) || 0;
    const o1 = parseFloat(document.getElementById('res-t1-overs').value) || 6.0;
    const w1 = parseInt(document.getElementById('res-t1-wkts').value) || 0;
    const r2 = parseInt(document.getElementById('res-t2-runs').value) || 0;
    const o2 = parseFloat(document.getElementById('res-t2-overs').value) || 6.0;
    const w2 = parseInt(document.getElementById('res-t2-wkts').value) || 0;
    const winner = document.getElementById('res-winner').value;

    try {
        // 0. Fetch existing match to handle leaderboard corrections
        const { data: oldM } = await supabaseClient.from('fixtures').select('*').eq('id', id).single();

        const topBatField = document.getElementById('res-top-bat').value.trim();
        const topBatRuns = parseInt(document.getElementById('res-top-bat-runs').value) || 0;
        const topBowlField = document.getElementById('res-top-bowl').value.trim();
        const topBowlWkts = parseInt(document.getElementById('res-top-bowl-wkts').value) || 0;

        let topBatName = topBatField;
        let topBowlName = topBowlField;

        // Helper to fetch Name & Team by Reg No
        const lookupPlayer = async (regNo) => {
            if (!regNo.toUpperCase().startsWith('OSATPL')) return { name: regNo, team: '' };

            // 1. Try team_players (to get team)
            const { data: tp } = await supabaseClient
                .from('team_players')
                .select('player_name, team_id')
                .eq('reg_no', regNo.toUpperCase())
                .maybeSingle();

            if (tp) {
                const { data: team } = await supabaseClient.from('points_table').select('team_name').eq('id', tp.team_id).maybeSingle();
                return { name: tp.player_name, team: team ? team.team_name : 'Individual' };
            }

            // 2. Fallback to player_registrations (for newly registered / unassigned players)
            const { data: pr } = await supabaseClient
                .from('player_registrations')
                .select('player_name')
                .eq('registration_no', regNo.toUpperCase())
                .maybeSingle();

            if (pr) return { name: pr.player_name, team: 'Unassigned' };

            return { name: regNo, team: '' }; // Final fallback
        };

        const topBatRes = await lookupPlayer(topBatField);
        topBatName = topBatRes.name;
        const topBatTeam = topBatRes.team;

        const topBowlRes = await lookupPlayer(topBowlField);
        topBowlName = topBowlRes.name;
        const topBowlTeam = topBowlRes.team;

        // 1. Update Fixture
        await supabaseClient.from('fixtures').update({
            status: 'completed',
            t1_score: r1,
            t2_score: r2,
            t1_wickets: w1,
            t2_wickets: w2,
            t1_overs: o1,
            t2_overs: o2,
            winner: winner,
            top_bat: topBatName,
            top_bat_runs: topBatRuns,
            top_bowl: topBowlName,
            top_bowl_wkts: topBowlWkts
        }).eq('id', id);

        // 1.5 Trigger Real-time sync for homepage (Update hero_content)
        await supabaseClient.from('hero_content').update({
            match_status: "Match Finalized",
            badge: "RESULT",
            team1_score: r1,
            team2_score: r2,
            match_date: `${topBatName} (${topBatRuns}) • ${topBowlName} (${topBowlWkts})` // Bonus: Show top performers on hero if you want
        }).eq('id', '00000000-0000-0000-0000-000000000001');

        // 2. Update Points Table Automatically (Full Sync)
        await syncPointsTableFromFixtures();

        // 3. Update Top Performers (Subtract OLD, Add NEW)
        if (oldM && oldM.status === 'completed') {
            if (oldM.top_bat) await updateTournamentCaps(oldM.top_bat, '', 'batsman', -oldM.top_bat_runs, 0);
            if (oldM.top_bowl) await updateTournamentCaps(oldM.top_bowl, '', 'bowler', 0, -oldM.top_bowl_wkts);
        }

        if (topBatName) await updateTournamentCaps(topBatName, topBatTeam, 'batsman', topBatRuns, 0);
        if (topBowlName) await updateTournamentCaps(topBowlName, topBowlTeam, 'bowler', 0, topBowlWkts);

        logActivity('Match', `Result updated: ${t1} vs ${t2}. Winner: ${winner}. Top Bat: ${topBatName}, Top Bowl: ${topBowlName}`);
        alert(`✅ Result Saved!\n🏆 Top Bat: ${topBatName}\n🎯 Top Bowl: ${topBowlName}`);
        closeResultModal();
        fetchFixtures();
        fetchResults();
    } catch (e) {
        alert("Error saving result: " + e.message);
    }
}

async function updateTournamentCaps(name, team, cat, r, w, balls = 0, matches = 0) {
    const { data: existing } = await supabaseClient
        .from('top_performers')
        .select('*')
        .eq('player_name', name)
        .eq('category', cat)
        .single();

    if (existing) {
        await supabaseClient.from('top_performers').update({
            runs: (existing.runs || 0) + r,
            wickets: (existing.wickets || 0) + w,
            balls: (existing.balls || 0) + balls,
            matches: (existing.matches || 0) + matches,
            team_name: team || existing.team_name
        }).eq('id', existing.id);
    } else {
        await supabaseClient.from('top_performers').insert([{
            player_name: name,
            team_name: team || 'Unknown',
            category: cat,
            runs: r,
            wickets: w,
            balls: balls,
            matches: matches
        }]);
    }
}

async function generateAutoCommentary(matchId, runVal, isWicket, extrasType, p1, p2, bowl) {
    let text = "";
    const pName = p1.name;

    if (isWicket) {
        text = `☝️ OUT! ${pName} is gone! Fantastic delivery by ${bowl.name}. What a breakthrough!`;
    } else if (runVal === 6) {
        text = `🚀 SIXER! ${pName} clears the boundary effortlessly! That's out of the park!`;
    } else if (runVal === 4) {
        text = `⚡ FOUR! Beautifully timed by ${pName}. It races away to the fence!`;
    } else if (extrasType === 'WD') {
        text = `⬅️ Wide Ball. Extra pressure on ${bowl.name} now.`;
    } else if (extrasType === 'NB') {
        text = `🔴 No Ball! Free hit opportunity for ${pName}!`;
    } else if (runVal === 0) {
        text = `🧤 Dot ball. Good comeback by ${bowl.name}.`;
    } else {
        text = `${pName} pushes it for ${runVal} run(s). Good rotation of strike.`;
    }

    try {
        await supabaseClient.from('match_commentary').insert([{
            match_id: matchId,
            commentary_text: text,
            ball_detail: `${liveMatchState.overs}.${liveMatchState.balls}`
        }]);
    } catch (e) {
        console.warn("Commentary push failed (table check required):", e.message);
    }

    // Also show as notification
    if (runVal >= 4 || isWicket) {
        showLiveNotification(text);
        broadcastMatchEvent(text);
    }
}

function showLiveNotification(msg) {
    const toast = document.createElement('div');
    toast.className = 'live-toast animate-fade';
    toast.innerHTML = `<strong>LIVE ALERT:</strong> ${msg}`;
    toast.style = `
        position: fixed; top: 20px; right: 20px;
        background: var(--primary); color: white;
        padding: 15px 25px; border-radius: 12px;
        z-index: 100000; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        font-weight: 700; border-left: 5px solid white;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}


// ================= PROFESSIONAL LIVE SCORING SYSTEM =================
let liveMatchState = {
    team_name: "",
    team1_name: "",
    team2_name: "",
    runs: 0, wkts: 0, overs: 0, balls: 0,
    max_overs: 6,
    max_wkts: 10,
    batsman1: { name: "Striker", runs: 0, balls: 0, f4s: 0, s6s: 0, reg: "" },
    batsman2: { name: "Non-Striker", runs: 0, balls: 0, f4s: 0, s6s: 0, reg: "" },
    bowler: { name: "Bowler", runs: 0, wkts: 0, overs: 0, balls: 0, reg: "" },
    striker: 1, // 1 or 2
    timeline: [],
    target: 0,
    inning: 1
};
let scoreHistory = [];
let redoHistory = [];

async function loadScoringSection() {
    const { data, error } = await supabaseClient
        .from('hero_content')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .single();

    if (error || !data) return;

    // Populate Fixture Dropdown
    const { data: fixtures } = await supabaseClient.from('fixtures').select('*').eq('status', 'upcoming');
    const fixSel = document.getElementById('score-fixture-id');
    if (fixSel && fixtures) {
        fixSel.innerHTML = '<option value="">-- Choose Match --</option>' +
            fixtures.map(f => `<option value="${f.id}">${f.team1} vs ${f.team2} (#${f.match_no})</option>`).join('');
    }

    liveMatchState = {
        team_name: data.team1_name || "Team A",
        team1_name: data.team1_name || "Team A",
        team2_name: data.team2_name || "Team B",
        runs: data.team1_score || 0,
        wkts: data.wickets || 0,
        overs: data.overs || 0,
        balls: data.balls || 0,
        max_overs: data.max_overs || 6,
        max_wkts: data.max_wickets || 10,
        batsman1: {
            name: data.batsman1 || "Striker",
            runs: data.batsman1_runs || 0,
            balls: data.batsman1_balls || 0,
            f4s: data.batsman1_4s || 0,
            s6s: data.batsman1_6s || 0,
            reg: data.batsman1_reg || ""
        },
        batsman2: {
            name: data.batsman2 || "Non-Striker",
            runs: data.batsman2_runs || 0,
            balls: data.batsman2_balls || 0,
            f4s: data.batsman2_4s || 0,
            s6s: data.batsman2_6s || 0,
            reg: data.batsman2_reg || ""
        },
        bowler: {
            name: data.bowler_name || "Bowler",
            runs: data.bowler_runs || 0,
            wkts: data.bowler_wickets || 0,
            overs: data.bowler_overs || 0,
            balls: data.bowler_over_balls || 0,
            reg: data.bowler_reg || ""
        },
        striker: data.striker_idx || 1,
        timeline: data.recent_balls ? data.recent_balls.split(',') : [],
        target: parseInt(data.badge?.replace('TARGET: ', '')) || 0,
        inning: data.badge?.includes('TARGET') ? 2 : 1
    };

    updateScoringUI();

    // Populate Winner Dropdown
    const winnerSel = document.getElementById('score-winner-select');
    if (winnerSel) {
        winnerSel.innerHTML = `
            <option value="">Select Winner Team</option>
            <option value="${liveMatchState.team1_name}">${liveMatchState.team1_name}</option>
            <option value="${liveMatchState.team2_name}">${liveMatchState.team2_name}</option>
            <option value="Draw">Draw/No Result</option>
        `;
    }
}

async function syncFixtureToScoring(fixtureId) {
    if (!fixtureId) return;
    const { data: f } = await supabaseClient.from('fixtures').select('*').eq('id', fixtureId).single();
    if (!f) return;

    if (!confirm(`Start scoring for ${f.team1} vs ${f.team2}? This will update the website live feed.`)) return;

    // Reset local state for new match
    resetInningsNoConfirm();
    liveMatchState.team1_name = f.team1;
    liveMatchState.team2_name = f.team2;
    liveMatchState.team_name = f.team1; // First innings batting Team1

    // Update Hero Content to reflect this match as LIVE
    await supabaseClient.from('hero_content').update({
        team1_name: f.team1,
        team2_name: f.team2,
        team1_score: 0,
        wickets: 0,
        overs: 0,
        balls: 0,
        match_status: "Match Started",
        badge: "LIVE MATCH"
    }).eq('id', '00000000-0000-0000-0000-000000000001');

    updateScoringUI();

    // Refresh Winner Dropdown
    const winnerSel = document.getElementById('score-winner-select');
    if (winnerSel) {
        winnerSel.innerHTML = `
            <option value="">Select Winner Team</option>
            <option value="${f.team1}">${f.team1}</option>
            <option value="${f.team2}">${f.team2}</option>
            <option value="Draw">Draw/No Result</option>
        `;
    }
}

function resetInningsNoConfirm() {
    scoreHistory = [];
    liveMatchState.runs = 0; liveMatchState.wkts = 0; liveMatchState.overs = 0; liveMatchState.balls = 0;
    liveMatchState.batsman1 = { name: "Striker", runs: 0, balls: 0, f4s: 0, s6s: 0, reg: "" };
    liveMatchState.batsman2 = { name: "Non-Striker", runs: 0, balls: 0, f4s: 0, s6s: 0, reg: "" };
    liveMatchState.bowler = { name: "Bowler", runs: 0, wkts: 0, overs: 0, balls: 0, reg: "" };
    liveMatchState.timeline = [];
    liveMatchState.inning = 1;
    liveMatchState.target = 0;
}

function updateScoringUI() {
    document.getElementById('score-display-team').innerText = liveMatchState.team_name;
    document.getElementById('score-display-runs').innerText = liveMatchState.runs;
    document.getElementById('score-display-wkts').innerText = liveMatchState.wkts;
    document.getElementById('score-display-overs').innerText = `${liveMatchState.overs}.${liveMatchState.balls} `;
    document.getElementById('score-max-overs').value = liveMatchState.max_overs;
    document.getElementById('score-max-wkts').value = liveMatchState.max_wkts;

    document.getElementById('score-p1-name').innerText = liveMatchState.batsman1.name;
    document.getElementById('score-p1-runs').innerText = liveMatchState.batsman1.runs;
    document.getElementById('score-p1-balls').innerText = liveMatchState.batsman1.balls;
    document.getElementById('score-p1-reg').value = liveMatchState.batsman1.reg;

    document.getElementById('score-p2-name').innerText = liveMatchState.batsman2.name;
    document.getElementById('score-p2-runs').innerText = liveMatchState.batsman2.runs;
    document.getElementById('score-p2-balls').innerText = liveMatchState.batsman2.balls;
    document.getElementById('score-p2-reg').value = liveMatchState.batsman2.reg;

    document.getElementById('score-bowl-name').innerText = liveMatchState.bowler.name;
    document.getElementById('score-bowl-runs').innerText = liveMatchState.bowler.runs;
    document.getElementById('score-bowl-wkts').innerText = liveMatchState.bowler.wkts;
    document.getElementById('score-bowl-overs').innerText = `${liveMatchState.bowler.overs}.${liveMatchState.bowler.balls}`;
    document.getElementById('score-bowl-reg').value = liveMatchState.bowler.reg;

    const p1Box = document.getElementById('player-1-box');
    const p2Box = document.getElementById('player-2-box');

    if (p1Box) {
        p1Box.style.border = liveMatchState.striker === 1 ? '2px solid var(--secondary)' : '1px solid rgba(255,255,255,0.05)';
        if (liveMatchState.striker === 1) p1Box.classList.remove('player-inactive');
        else p1Box.classList.add('player-inactive');
    }

    if (p2Box) {
        p2Box.style.border = liveMatchState.striker === 2 ? '2px solid var(--secondary)' : '1px solid rgba(255,255,255,0.05)';
        if (liveMatchState.striker === 2) p2Box.classList.remove('player-inactive');
        else p2Box.classList.add('player-inactive');
    }

    const timeline = document.getElementById('score-timeline');
    timeline.innerHTML = liveMatchState.timeline.map(b => `<div class="ball ${b == '4' ? 'boundary' : b == '6' ? 'six' : b.toLowerCase().includes('w') ? 'wicket' : ''}">${b}</div>`).join('');
}

async function fetchPlayerForScore(type) {
    const regId = type === 1 ? 'score-p1-reg' : type === 2 ? 'score-p2-reg' : 'score-bowl-reg';
    const regNo = document.getElementById(regId).value.trim().toUpperCase();
    if (!regNo) return;

    const { data } = await supabaseClient.from('player_registrations').select('player_name').eq('registration_no', regNo).single();
    if (!data) return alert("Not Found");

    if (type === 1) { liveMatchState.batsman1.name = data.player_name; liveMatchState.batsman1.reg = regNo; }
    else if (type === 2) { liveMatchState.batsman2.name = data.player_name; liveMatchState.batsman2.reg = regNo; }
    else { liveMatchState.bowler.name = data.player_name; liveMatchState.bowler.reg = regNo; }

    // Close any open dropdowns
    const dropId = type === 1 ? 'score-p1-dropdown' : type === 2 ? 'score-p2-dropdown' : 'score-bowl-dropdown';
    const dropdown = document.getElementById(dropId);
    if (dropdown) dropdown.style.display = 'none';

    updateScoringUI();
}

function filterScoringPlayers(query, type) {
    const dropId = type === 1 ? 'score-p1-dropdown' : type === 2 ? 'score-p2-dropdown' : 'score-bowl-dropdown';
    const dropdown = document.getElementById(dropId);
    const parentBox = type === 1 ? document.getElementById('player-1-box') : type === 2 ? document.getElementById('player-2-box') : null;

    if (!query || query.length < 1) {
        if (dropdown) dropdown.style.display = 'none';
        if (parentBox) parentBox.classList.remove('search-active-context');
        return;
    }

    if (parentBox) parentBox.classList.add('search-active-context');

    if (!allPaidPlayersForAuction || allPaidPlayersForAuction.length === 0) {
        fetchPaidPlayersForAutocomplete();
        if (dropdown) {
            dropdown.innerHTML = '<div style="padding: 10px; color: var(--text-dim);">Loading...</div>';
            dropdown.style.display = 'block';
        }
        return;
    }

    query = query.toLowerCase().trim();
    const filtered = allPaidPlayersForAuction.filter(p =>
        (p.player_name && p.player_name.toLowerCase().includes(query)) ||
        (p.registration_no && p.registration_no.toLowerCase().includes(query))
    ).slice(0, 10);

    if (dropdown) {
        if (filtered.length === 0) {
            dropdown.innerHTML = '<div style="padding: 10px; color: var(--text-dim);">No matches</div>';
        } else {
            dropdown.innerHTML = filtered.map(p => `
                <div class="dropdown-item" onclick="selectScoringPlayer('${p.registration_no}', '${p.player_name.replace(/'/g, "\\'")}', ${type})">
                    <img src="${p.photo_url || 'img.jpg'}">
                    <div class="player-info">
                        <div class="player-name">${p.player_name}</div>
                        <div class="reg-no">REG: ${p.registration_no}</div>
                    </div>
                </div>
            `).join('');
        }
        dropdown.style.display = 'block';
    }
}

function selectScoringPlayer(regNo, name, type) {
    const regId = type === 1 ? 'score-p1-reg' : type === 2 ? 'score-p2-reg' : 'score-bowl-reg';
    const dropId = type === 1 ? 'score-p1-dropdown' : type === 2 ? 'score-p2-dropdown' : 'score-bowl-dropdown';

    const regInput = document.getElementById(regId);
    if (regInput) regInput.value = regNo;

    const dropdown = document.getElementById(dropId);
    if (dropdown) dropdown.style.display = 'none';

    const parentBox = type === 1 ? document.getElementById('player-1-box') : type === 2 ? document.getElementById('player-2-box') : null;
    if (parentBox) parentBox.classList.remove('search-active-context');

    if (type === 1) { liveMatchState.batsman1.name = name; liveMatchState.batsman1.reg = regNo; }
    else if (type === 2) { liveMatchState.batsman2.name = name; liveMatchState.batsman2.reg = regNo; }
    else { liveMatchState.bowler.name = name; liveMatchState.bowler.reg = regNo; }

    updateScoringUI();
}

function handleScoreAction(val) {
    // Push current state to history before making changes
    scoreHistory.push(JSON.parse(JSON.stringify(liveMatchState)));
    if (scoreHistory.length > 20) scoreHistory.shift();
    redoHistory = [];

    const maxOvers = parseInt(document.getElementById('score-max-overs').value) || 6;
    const maxWkts = parseInt(document.getElementById('score-max-wkts').value) || 10;
    liveMatchState.max_overs = maxOvers;
    liveMatchState.max_wkts = maxWkts;

    // Check for Win in 2nd Innings
    if (liveMatchState.inning === 2 && liveMatchState.target > 0) {
        if (liveMatchState.runs >= liveMatchState.target) {
            showToast(`${liveMatchState.team_name} WON THE MATCH! 🏆`, "success");
            return;
        }
    }

    if (liveMatchState.overs >= maxOvers || liveMatchState.wkts >= maxWkts) {
        showToast("Innings Over! Please start next innings or reset.", "error");
        return;
    }

    // Check if current action pushes it over
    if (val === 'W' && liveMatchState.wkts + 1 >= maxWkts) {
        showToast("ALL OUT! Innings Ended.", "warning");
    }
    const isWicket = val === 'W';
    const isWide = val === 'WD';
    const isNoBall = val === 'NB';
    const runs = typeof val === 'number' ? val : 0;

    if (!isWicket) {
        liveMatchState.runs += runs;
        if (isWide || isNoBall) liveMatchState.runs += 1;
    } else {
        liveMatchState.wkts += 1;
    }

    const striker = liveMatchState.striker === 1 ? liveMatchState.batsman1 : liveMatchState.batsman2;
    if (!isWide) {
        striker.runs += runs;
        striker.balls += 1;
        if (runs === 4) striker.f4s += 1;
        if (runs === 6) striker.s6s += 1;
    }

    if (!isWide && !isNoBall) {
        liveMatchState.bowler.balls += 1;
        if (liveMatchState.bowler.balls >= 6) { liveMatchState.bowler.balls = 0; liveMatchState.bowler.overs += 1; }
    }
    if (isWicket) liveMatchState.bowler.wkts += 1;
    liveMatchState.bowler.runs += (runs + (isWide || isNoBall ? 1 : 0));

    if (!isWide && !isNoBall) {
        liveMatchState.balls += 1;
        if (liveMatchState.balls >= 6) { liveMatchState.balls = 0; liveMatchState.overs += 1; switchStrike(); }
    }

    liveMatchState.timeline.push(val);
    if (liveMatchState.timeline.length > 8) liveMatchState.timeline.shift();

    // 📡 GENERATE AUTO-COMMENTARY
    const fixtureId = document.getElementById('score-fixture-id')?.value;
    if (fixtureId) {
        const strikerObj = liveMatchState.striker === 1 ? liveMatchState.batsman1 : liveMatchState.batsman2;
        generateAutoCommentary(fixtureId, runs, isWicket,
            isWide ? 'WD' : isNoBall ? 'NB' : '',
            strikerObj, {}, liveMatchState.bowler);
    }

    if (runs % 2 !== 0 && !isWide && !isNoBall) switchStrike();

    updateScoringUI();

    // After update, check for Win condition
    if (liveMatchState.inning === 2 && liveMatchState.target > 0) {
        if (liveMatchState.runs >= liveMatchState.target) {
            const winText = `MATCH COMPLETED: ${liveMatchState.team_name} WON! 🏆`;
            showToast(winText, "success");
            supabaseClient.from('hero_content').update({
                match_status: winText,
                badge: "COMPLETED"
            }).eq('id', '00000000-0000-0000-0000-000000000001');
        } else {
            // Update required runs
            const req = liveMatchState.target - liveMatchState.runs;
            supabaseClient.from('hero_content').update({
                match_status: `${liveMatchState.team_name} needs ${req} runs from ${((liveMatchState.max_overs * 6) - (liveMatchState.overs * 6 + liveMatchState.balls))} balls.`
            }).eq('id', '00000000-0000-0000-0000-000000000001');
        }
    }
}

function switchStrike() {
    liveMatchState.striker = liveMatchState.striker === 1 ? 2 : 1;
    updateScoringUI();
}

async function saveLiveScore() {
    const updates = {
        team1_score: liveMatchState.runs,
        wickets: liveMatchState.wkts,
        overs: liveMatchState.overs,
        balls: liveMatchState.balls,
        batsman1: liveMatchState.batsman1.name,
        batsman1_runs: liveMatchState.batsman1.runs,
        batsman1_balls: liveMatchState.batsman1.balls,
        batsman1_4s: liveMatchState.batsman1.f4s,
        batsman1_6s: liveMatchState.batsman1.s6s,
        batsman1_reg: liveMatchState.batsman1.reg,
        batsman2: liveMatchState.batsman2.name,
        batsman2_runs: liveMatchState.batsman2.runs,
        batsman2_balls: liveMatchState.batsman2.balls,
        batsman2_4s: liveMatchState.batsman2.f4s,
        batsman2_6s: liveMatchState.batsman2.s6s,
        batsman2_reg: liveMatchState.batsman2.reg,
        bowler_name: liveMatchState.bowler.name,
        bowler_runs: liveMatchState.bowler.runs,
        bowler_wickets: liveMatchState.bowler.wkts,
        bowler_overs: liveMatchState.bowler.overs,
        bowler_over_balls: liveMatchState.bowler.balls,
        bowler_reg: liveMatchState.bowler.reg,
        striker_idx: liveMatchState.striker,
        max_overs: liveMatchState.max_overs,
        recent_balls: liveMatchState.timeline.join(',')
    };

    const { error } = await supabaseClient.from('hero_content').update(updates).eq('id', '00000000-0000-0000-0000-000000000001');

    // ALSO SYNC TO FIXTURES TABLE REALTIME
    const fixtureId = document.getElementById('score-fixture-id').value;
    if (fixtureId) {
        const is2ndInning = liveMatchState.inning === 2;
        const currentOvers = parseFloat(`${liveMatchState.overs}.${liveMatchState.balls}`);

        const fixtureSync = {
            t1_score: is2ndInning ? (liveMatchState.t1_score || (liveMatchState.target - 1)) : liveMatchState.runs,
            t1_wickets: is2ndInning ? (liveMatchState.t1_wickets || 10) : liveMatchState.wkts,
            t1_overs: is2ndInning ? (liveMatchState.t1_overs || 6.0) : currentOvers,
            t2_score: is2ndInning ? liveMatchState.runs : 0,
            t2_wickets: is2ndInning ? liveMatchState.wkts : 0,
            t2_overs: is2ndInning ? currentOvers : 0.0,
            status: 'live' // Force status to live if sync is happening
        };

        await supabaseClient.from('fixtures').update(fixtureSync).eq('id', fixtureId);
    }

    if (error) alert(error.message);
    else showSuccessPopup("Live Scorecard Updated Successfully! 🚀");
}

function resetInnings() {
    if (!confirm("Reset?")) return;
    scoreHistory = [];
    liveMatchState.runs = 0; liveMatchState.wkts = 0; liveMatchState.overs = 0; liveMatchState.balls = 0;
    liveMatchState.batsman1 = { name: "Striker", runs: 0, balls: 0, f4s: 0, s6s: 0, reg: "" };
    liveMatchState.batsman2 = { name: "Non-Striker", runs: 0, balls: 0, f4s: 0, s6s: 0, reg: "" };
    liveMatchState.bowler = { name: "Bowler", runs: 0, wkts: 0, overs: 0, balls: 0, reg: "" };
    liveMatchState.timeline = [];
    updateScoringUI();
}

function undoLastBall() {
    if (scoreHistory.length === 0) {
        showToast("No balls to undo!", "info");
        return;
    }
    // Save current state to redo history
    redoHistory.push(JSON.parse(JSON.stringify(liveMatchState)));

    const lastState = scoreHistory.pop();
    liveMatchState = lastState;
    updateScoringUI();
    showToast("Last ball undone! ↩️", "info");
}

function redoLastBall() {
    if (redoHistory.length === 0) {
        showToast("No balls to redo!", "info");
        return;
    }
    // Save current state back to undo history
    scoreHistory.push(JSON.parse(JSON.stringify(liveMatchState)));

    const nextState = redoHistory.pop();
    liveMatchState = nextState;
    updateScoringUI();
    showToast("Ball re-done! ↪️", "info");
}

async function startSecondInnings() {
    if (liveMatchState.wkts < liveMatchState.max_wkts && liveMatchState.overs < liveMatchState.max_overs) {
        if (!confirm("The 1st Innings isn't finished yet. Are you sure you want to start the chase?")) return;
    }

    const firstInningsScore = liveMatchState.runs;
    const firstInningsOvers = parseFloat(`${liveMatchState.overs}.${liveMatchState.balls}`);
    const firstInningsWkts = liveMatchState.wkts;
    const chasingTeam = liveMatchState.team2_name;

    if (!confirm(`Switching to 2nd Innings. ${chasingTeam} will bat now. Target: ${firstInningsScore + 1}. Continue?`)) return;

    // Save T1 Stats into State
    liveMatchState.t1_score = firstInningsScore;
    liveMatchState.t1_overs = firstInningsOvers;
    liveMatchState.t1_wickets = firstInningsWkts;

    // Reset for 2nd Innings
    liveMatchState.team_name = chasingTeam;
    liveMatchState.runs = 0;
    liveMatchState.wkts = 0;
    liveMatchState.overs = 0;
    liveMatchState.balls = 0;
    liveMatchState.batsman1 = { name: "Striker", runs: 0, balls: 0, f4s: 0, s6s: 0, reg: "" };
    liveMatchState.batsman2 = { name: "Non-Striker", runs: 0, balls: 0, f4s: 0, s6s: 0, reg: "" };
    liveMatchState.bowler = { name: "Bowler", runs: 0, wkts: 0, overs: 0, balls: 0, reg: "" };
    liveMatchState.timeline = [];
    scoreHistory = [];
    redoHistory = [];

    updateScoringUI();
    liveMatchState.inning = 2;
    liveMatchState.target = firstInningsScore + 1;

    // Update Badge to reflect 2nd Innings / Target
    const badgeText = `TARGET: ${firstInningsScore + 1}`;
    await supabaseClient.from('hero_content').update({
        badge: badgeText,
        team1_score: 0,
        wickets: 0,
        overs: 0,
        balls: 0,
        match_status: `${chasingTeam} needs ${firstInningsScore + 1} runs to win.`
    }).eq('id', '00000000-0000-0000-0000-000000000001');

    showToast(`2nd Innings Started! Target: ${firstInningsScore + 1} `, "success");
}

async function finalizeLiveMatch() {
    const winner = document.getElementById('score-winner-select').value;
    if (!winner) {
        showToast("Please select the winner team!", "error");
        return;
    }

    if (!confirm("Are you sure you want to finalize this match and save to results?")) return;

    try {
        const id = document.getElementById('score-fixture-id').value;
        if (!id) {
            showToast("Please select the fixture first in the dropdown above!", "error");
            return;
        }

        // 1. Fetch current live fixture to get scores etc
        const { data: m } = await supabaseClient.from('fixtures').select('*').eq('id', id).single();
        if (!m) throw new Error("Match not found in fixtures table");

        // 2. Update Fixture Status & Results
        const is2ndInning = liveMatchState.inning === 2;
        const currentOvers = parseFloat(`${liveMatchState.overs}.${liveMatchState.balls}`);

        const topBat = document.getElementById('score-top-bat').value;
        const topBatRuns = parseInt(document.getElementById('score-top-bat-runs').value) || 0;
        const topBowl = document.getElementById('score-top-bowl').value;
        const topBowlWkts = parseInt(document.getElementById('score-top-bowl-wkts').value) || 0;

        const finalData = {
            status: 'completed',
            winner: winner,
            t1_score: is2ndInning ? (liveMatchState.t1_score || (liveMatchState.target - 1)) : liveMatchState.runs,
            t1_wickets: is2ndInning ? (liveMatchState.t1_wickets || 10) : liveMatchState.wkts,
            t1_overs: is2ndInning ? (liveMatchState.t1_overs || 6.0) : currentOvers,
            t2_score: is2ndInning ? liveMatchState.runs : 0,
            t2_wickets: is2ndInning ? liveMatchState.wkts : 0,
            t2_overs: is2ndInning ? currentOvers : 0.0,
            top_bat: topBat,
            top_bat_runs: topBatRuns,
            top_bowl: topBowl,
            top_bowl_wkts: topBowlWkts
        };

        await supabaseClient.from('fixtures').update(finalData).eq('id', id);

        // 2.5 Trigger Home Sync & Clear Live Match from Hero
        await supabaseClient.from('hero_content').update({
            badge: "RESULT",
            match_status: `${winner} won the match!`,
            team1_score: finalData.t1_score,
            team2_score: finalData.t2_score,
            wickets: finalData.t1_wickets,
            overs: finalData.t1_overs,
            balls: 0
        }).eq('id', '00000000-0000-0000-0000-000000000001');

        // 3. Update Points Table
        await syncPointsTableFromFixtures();

        // 4. Update Top Performers (Subtract OLD if exists, Add NEW)
        if (m && m.status === 'completed') {
            if (m.top_bat) await updateTournamentCaps(m.top_bat, '', 'batsman', -m.top_bat_runs, 0);
            if (m.top_bowl) await updateTournamentCaps(m.top_bowl, '', 'bowler', 0, -m.top_bowl_wkts);
        }

        if (topBat) await updateTournamentCaps(topBat, '', 'batsman', topBatRuns, 0, 0, 1);
        if (topBowl) await updateTournamentCaps(topBowl, '', 'bowler', 0, topBowlWkts, 0, 1);

        showSuccessPopup("Match Finalized & Results Updated Successfully! 🏆");

        // Refresh UI
        fetchResults();
        fetchFixtures();
    } catch (e) {
        console.error(e);
        showToast("Error finalizing match: " + e.message, "error");
    }
}

function showSuccessPopup(msg) {
    const modal = document.getElementById('success-modal');
    const msgEl = document.getElementById('success-message');
    if (modal && msgEl) {
        msgEl.innerText = msg;
        modal.style.display = 'flex';
        // Auto close after 3 seconds
        setTimeout(() => closeSuccessModal(), 3000);
    }
}

function closeSuccessModal() {
    const modal = document.getElementById('success-modal');
    if (modal) modal.style.display = 'none';
}

// --- UNIFIED MATCH MANAGEMENT ---

window.syncTeamDropdowns = async function () {
    console.log("🔄 Syncing Team Dropdowns...");
    const { data: teams } = await supabaseClient.from('points_table').select('team_name').order('team_name');
    if (teams) {
        const selects = document.querySelectorAll('.team-selector-sync');
        console.log(`Found ${selects.length} dropdowns to sync.`);
        selects.forEach(select => {
            const currentVal = select.value;
            select.innerHTML = '<option value="">Select Team</option>' +
                teams.map(t => `<option value="${t.team_name}">${t.team_name}</option>`).join('');
            if (currentVal) select.value = currentVal;
        });
    }
}

window.startLiveMatch = async function (id) {
    const { data: f } = await supabaseClient.from('fixtures').select('*').eq('id', id).single();
    if (!f) return alert("Fixture not found!");

    // 1. Switch Admin Section to Control Center
    showSection('hero-section');

    // 2. Set Selector to LIVE MATCH
    const selector = document.getElementById('match-type-selector');
    if (selector) selector.value = 'live-match';

    // 3. Populate Control Center with Fixture Data
    await loadHero('live-match');

    const t1 = f.t1_name || f.team1;
    const t2 = f.t2_name || f.team2;

    document.getElementById('hero-team1-name').value = t1;
    document.getElementById('hero-team2-name').value = t2;
    document.getElementById('hero-badge').value = "LIVE NOW";
    document.getElementById('hero-time').value = f.venue || "Tournament Ground";

    // Reset scores
    document.getElementById('hero-team1-score').value = 0;
    document.getElementById('hero-team2-score').value = 0;
    if (document.getElementById('hero-wickets')) {
        document.getElementById('hero-wickets').value = 0;
        document.getElementById('hero-overs').value = 0;
        document.getElementById('hero-balls').value = 0;
    }

    // Show Finalize button
    const finalBtn = document.getElementById('finalize-match-btn');
    if (finalBtn) finalBtn.style.display = 'inline-block';

    alert(`🚀 Match Started: ${t1} vs ${t2}\nUpdating Live Feed...`);
    await saveHero();
}

window.finalizeLiveMatch = async function () {
    const t1 = document.getElementById('hero-team1-name').value;
    const t2 = document.getElementById('hero-team2-name').value;
    const r1 = document.getElementById('hero-team1-score').value;
    const r2 = document.getElementById('hero-team2-score').value;

    if (!t1 || !t2) return alert("No live match active to finalize!");

    const { data: fixtures } = await supabaseClient
        .from('fixtures')
        .select('id, match_no')
        .or(`t1_name.eq."${t1}",team1.eq."${t1}"`)
        .neq('status', 'completed')
        .order('match_no', { ascending: false });

    let fixtureId = "";
    if (fixtures && fixtures.length > 0) {
        fixtureId = fixtures[0].id;
    }

    if (!fixtureId && !confirm(`No active fixture found for ${t1}. Open Results Manager anyway?`)) return;

    await openResultModal(fixtureId || "", t1, t2);

    if (document.getElementById('res-t1-runs')) {
        document.getElementById('res-t1-runs').value = r1;
        document.getElementById('res-t2-runs').value = r2;
    }

    const finalBtn = document.getElementById('finalize-match-btn');
    if (finalBtn) finalBtn.style.display = 'none';
}

window.lookupHeroPlayer = async function (type) {
    const fieldId = type === 'bat' ? 'hero-batsman1' : 'hero-bowler1';
    const regInput = document.getElementById(`${fieldId}-reg`);
    if (!regInput) return;
    const regNo = regInput.value.trim().toUpperCase();
    if (!regNo.startsWith('OSATPL')) return;

    const { data: tp } = await supabaseClient.from('team_players').select('player_name').eq('reg_no', regNo).maybeSingle();
    if (tp) {
        document.getElementById(`${fieldId}`).value = tp.player_name;
        return;
    }
    if (pr) {
        document.getElementById(`${fieldId}`).value = pr.player_name;
    }
}

// ================= AUCTION CONTROL =================
let adminAuctionTimerInterval = null;
let currentAuctionPlayer = null;

async function initAdminAuction() {
    console.log("🔨 Initializing Admin Auction Control...");

    // Initial State Fetch
    const { data, error } = await supabaseClient
        .from('auction_settings')
        .select('*')
        .eq('id', 'global')
        .single();

    if (data) {
        updateAdminAuctionUI(data);
    }

    // Subscribe to Bids
    supabaseClient
        .channel('admin_auction_bids')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_bids' }, payload => {
            console.log("🚀 Bid activity in Admin Panel:", payload.eventType);
            fetchAdminAuctionState();
            fetchAdminBidHistory();
        })
        .subscribe();

    fetchAdminBidHistory();
}

async function fetchAdminAuctionState() {
    const { data } = await supabaseClient.from('auction_settings').select('*').eq('id', 'global').single();
    if (data) updateAdminAuctionUI(data);
}

async function fetchAdminBidHistory() {
    const list = document.getElementById('admin-bid-history');
    if (!list) return;

    // Fetch latest 10 bids
    const { data, error } = await supabaseClient
        .from('auction_bids')
        .select('*, points_table(team_name)')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) return console.error("History fetch error:", error);

    if (!data || data.length === 0) {
        list.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-dim);">No bids yet</td></tr>';
        return;
    }

    list.innerHTML = data.map(bid => `
        <tr>
            <td style="font-size: 0.75rem;">${new Date(bid.created_at).toLocaleTimeString()}</td>
            <td style="font-weight: 700;">${bid.points_table ? bid.points_table.team_name : '---'}</td>
            <td style="color: var(--secondary); font-weight: 800;">₹${bid.bid_amount.toLocaleString()}</td>
            <td>
                <button class="btn" style="background: #ef4444; font-size: 0.7rem; padding: 4px 8px;" 
                    onclick="deleteBid('${bid.id}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

async function deleteBid(bidId) {
    if (!confirm("Are you sure you want to delete this bid? It will rollback the auction state.")) return;

    // 1. Delete the bid
    const { error: delError } = await supabaseClient.from('auction_bids').delete().eq('id', bidId);
    if (delError) return alert("Delete failed: " + delError.message);

    // 2. Fetch latest bid for the current player to rollback settings
    const { data: settings } = await supabaseClient.from('auction_settings').select('current_player_id').eq('id', 'global').single();

    const { data: latestBids } = await supabaseClient
        .from('auction_bids')
        .select('*')
        .eq('player_id', settings.current_player_id)
        .order('bid_amount', { ascending: false })
        .limit(1);

    if (latestBids && latestBids.length > 0) {
        // Rollback to previous bid
        await supabaseClient.from('auction_settings').update({
            current_bid: latestBids[0].bid_amount,
            highest_bidder_id: latestBids[0].team_id
        }).eq('id', 'global');
    } else {
        // No bids left, wait for admin to re-set (or we could try to find the base price, 
        // but it's safer to just set highest_bidder_id to null and let admin decide)
        await supabaseClient.from('auction_settings').update({
            highest_bidder_id: null
        }).eq('id', 'global');
        alert("All bids for this player deleted. Please re-set base price if needed by putting player on board again.");
    }

    showToast("Bid deleted and state rolled back!", "info");
}

async function updateAdminAuctionUI(settings) {
    const statusLabel = document.getElementById('admin-auction-status');
    statusLabel.innerText = settings.status.toUpperCase();
    statusLabel.className = `status-badge ${settings.status === 'bidding' ? 'paid' : 'pending'}`;

    document.getElementById('admin-current-bid').innerText = `₹${settings.current_bid.toLocaleString()}`;
    document.getElementById('admin-auction-timer').innerText = `${settings.timer_seconds}s`;

    if (settings.highest_bidder_id) {
        const { data: team } = await supabaseClient.from('points_table').select('team_name').eq('id', settings.highest_bidder_id).single();
        document.getElementById('admin-highest-bidder').innerText = team ? team.team_name : '---';
    } else {
        document.getElementById('admin-highest-bidder').innerText = '---';
    }
}

let allPaidPlayersForAuction = [];

// Fetch all paid players for fast autocomplete
async function fetchPaidPlayersForAutocomplete() {
    try {
        const { data, error } = await supabaseClient
            .from('player_registrations')
            .select('id, registration_no, player_name, photo_url, batting, bowling, status, payment_status')
            .in('payment_status', ['paid', 'completed']);

        if (!error && data) {
            allPaidPlayersForAuction = data;
        }
    } catch (e) {
        console.error("Error fetching players for autocomplete:", e);
    }
}

// Ensure it loads properly
document.addEventListener('DOMContentLoaded', () => {
    fetchPaidPlayersForAutocomplete();
});

function filterAuctionNames(query) {
    const dropdown = document.getElementById('auction-name-dropdown');

    // Trigger even with 1 character
    if (!query || query.length < 1) {
        dropdown.style.display = 'none';
        return;
    }

    // Ensure data is loaded
    if (!allPaidPlayersForAuction || allPaidPlayersForAuction.length === 0) {
        fetchPaidPlayersForAutocomplete();
        dropdown.innerHTML = '<div style="padding: 10px; color: var(--text-dim); text-align: center;">Loading...</div>';
        dropdown.style.display = 'block';
        return;
    }

    query = query.toLowerCase().trim();

    // Filter logic: Check if player name includes the exact typed string
    const filtered = allPaidPlayersForAuction.filter(p => {
        if (!p || !p.player_name) return false;
        return p.player_name.toLowerCase().includes(query);
    }).slice(0, 15); // Show max 15 results

    if (filtered.length === 0) {
        dropdown.innerHTML = '<div style="padding: 15px; color: #94a3b8; text-align: center; font-weight: 600;">No matches found</div>';
    } else {
        dropdown.innerHTML = filtered.map(p => {
            const isSold = p.status && p.status.toLowerCase() === 'sold';
            return `
                <div style="padding: 12px 18px; border-bottom: 1px solid rgba(255,255,255,0.08); cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 12px; transition: all 0.2s;"
                     onmouseover="this.style.background='rgba(0, 242, 255, 0.15)'"
                     onmouseout="this.style.background='transparent'"
                     onclick="selectAuctionPlayerFromDropdown('${p.registration_no}', '${(p.player_name || '').replace(/'/g, "\\'")}')">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <img src="${p.photo_url || 'img.jpg'}" style="width: 42px; height: 42px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(255,255,255,0.15);">
                        <div>
                            <div style="font-weight: 800; font-size: 1.05rem; color: ${isSold ? '#64748b' : '#ffffff'}; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">${p.player_name}</div>
                            <div style="font-size: 0.8rem; color: #94a3b8; font-weight: 600;">Reg: ${p.registration_no}</div>
                        </div>
                    </div>
                    ${isSold ? '<span style="background: #ef4444; color: white; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 900; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);">SOLD</span>' : ''}
                </div>
            `;
        }).join('');
    }
    dropdown.style.display = 'block';
}

function selectAuctionPlayerFromDropdown(regNo, name) {
    document.getElementById('auction-search-name').value = name;
    document.getElementById('auction-search-reg').value = regNo; // Also fill reg no field just in case
    document.getElementById('auction-name-dropdown').style.display = 'none';
    lookupAuctionPlayerByRegDirectly(regNo);
}

// Close dropdown when clicking outside
document.addEventListener('click', function (e) {
    const dropdown = document.getElementById('auction-name-dropdown');
    const input = document.getElementById('auction-search-name');
    if (dropdown && input && !dropdown.contains(e.target) && e.target !== input) {
        dropdown.style.display = 'none';
    }
});

async function lookupAuctionPlayerByName() {
    const nameInput = document.getElementById('auction-search-name').value.trim();
    if (!nameInput) return alert("Enter Player Name");

    // Try finding exact or partial match from pre-loaded list first
    const match = allPaidPlayersForAuction.find(p => p.player_name.toLowerCase() === nameInput.toLowerCase());

    if (match) {
        lookupAuctionPlayerByRegDirectly(match.registration_no);
    } else {
        // Fallback to database query if not found in list
        const { data, error } = await supabaseClient
            .from('player_registrations')
            .select('*')
            .ilike('player_name', `%${nameInput}%`)
            .in('status', ['paid', 'unsold'])
            .limit(1);

        if (error || !data || data.length === 0) return alert("Player not found or not in 'paid/unsold' status!");

        displayAuctionPlayerPreview(data[0]);
    }
}

async function lookupAuctionPlayerByRegDirectly(regNo) {
    const { data, error } = await supabaseClient
        .from('player_registrations')
        .select('*')
        .eq('registration_no', regNo)
        .single();

    if (error || !data) return alert("Player not found!");
    displayAuctionPlayerPreview(data);
}

function displayAuctionPlayerPreview(data) {
    currentAuctionPlayer = data;
    document.getElementById('auction-p-photo').src = data.photo_url || 'img.jpg';
    document.getElementById('auction-p-name').innerText = data.player_name;
    document.getElementById('auction-p-reg').innerText = data.registration_no;
    document.getElementById('auction-p-role').innerText = `${data.batting || 'Right'} Bat | ${data.bowling || 'Right'} Bowl`;
    document.getElementById('auction-player-preview').style.display = 'block';

    // Status Check
    const putOnBtn = document.querySelector('button[onclick="putPlayerOnAuction()"]');
    if (data.status === 'sold') {
        putOnBtn.disabled = true;
        putOnBtn.style.opacity = '0.5';
        putOnBtn.innerText = `Player Already SOLD`;
    } else {
        putOnBtn.disabled = false;
        putOnBtn.style.opacity = '1';
        putOnBtn.innerText = 'Put on Auction Board';
    }
}

async function lookupAuctionPlayer() {
    const regNo = document.getElementById('auction-search-reg').value.trim().toUpperCase();
    if (!regNo) return alert("Enter Reg No");

    lookupAuctionPlayerByRegDirectly(regNo);
}

async function putPlayerOnAuction() {
    if (!currentAuctionPlayer) return;
    const basePrice = parseInt(document.getElementById('auction-base-price').value) || 150;

    const { error } = await supabaseClient
        .from('auction_settings')
        .update({
            current_player_id: currentAuctionPlayer.id,
            current_bid: basePrice,
            highest_bidder_id: null,
            status: 'idle',
            timer_seconds: 30
        })
        .eq('id', 'global');

    if (error) alert("Error: " + error.message);
    else {
        alert("Player placed on auction board!");
        fetchAdminAuctionState();
    }
}

async function startAuctionTimer() {
    await supabaseClient.from('auction_settings').update({ status: 'bidding' }).eq('id', 'global');

    if (adminAuctionTimerInterval) clearInterval(adminAuctionTimerInterval);

    adminAuctionTimerInterval = setInterval(async () => {
        const { data } = await supabaseClient.from('auction_settings').select('timer_seconds, status').eq('id', 'global').single();
        if (data && data.status === 'bidding' && data.timer_seconds > 0) {
            await supabaseClient.from('auction_settings').update({ timer_seconds: data.timer_seconds - 1 }).eq('id', 'global');
            document.getElementById('admin-auction-timer').innerText = `${data.timer_seconds - 1}s`;
        } else if (data && data.timer_seconds === 0) {
            clearInterval(adminAuctionTimerInterval);
        }
    }, 1000);
}

async function pauseAuctionTimer() {
    clearInterval(adminAuctionTimerInterval);
    await supabaseClient.from('auction_settings').update({ status: 'idle' }).eq('id', 'global');
}

async function resetAuctionTimer() {
    clearInterval(adminAuctionTimerInterval);
    await supabaseClient.from('auction_settings').update({ timer_seconds: 30 }).eq('id', 'global');
    document.getElementById('admin-auction-timer').innerText = `30s`;
}

async function markAsUnsold() {
    const { data: settings } = await supabaseClient.from('auction_settings').select('current_player_id').eq('id', 'global').single();
    if (!settings || !settings.current_player_id) return alert("No active player!");

    if (!confirm("Are you sure you want to mark this player as UNSOLD?")) return;

    clearInterval(adminAuctionTimerInterval);

    // 1. Update registrations
    await supabaseClient.from('player_registrations').update({ status: 'unsold' }).eq('id', settings.current_player_id);

    // 2. Update auction settings
    await supabaseClient.from('auction_settings').update({ status: 'unsold' }).eq('id', 'global');

    alert("Player marked as UNSOLD");
    fetchAdminAuctionState();
}

async function finalizeSale() {
    const { data: settings } = await supabaseClient.from('auction_settings').select('*').eq('id', 'global').single();
    if (!settings || !settings.current_player_id || !settings.highest_bidder_id) {
        return alert("No active bid to finalize!");
    }

    if (!confirm("Are you sure you want to finalize this sale?")) return;

    // 1. Get Team Name
    const { data: team } = await supabaseClient.from('points_table').select('*').eq('id', settings.highest_bidder_id).single();
    // 2. Get Player Name
    const { data: player } = await supabaseClient.from('player_registrations').select('*').eq('id', settings.current_player_id).single();

    // 2.5 Safe Clearance: Ensure any ghost records are removed before assignment
    console.log("🧹 Clearing any existing squad records for this player...");
    await supabaseClient.from('team_players').delete().eq('reg_no', player.registration_no);

    // 3. Insert into team_players
    const { error: squadError } = await supabaseClient.from('team_players').insert([{
        team_id: team.id,
        team_name: team.team_name,
        player_name: player.player_name,
        reg_no: player.registration_no,
        bid_amount: settings.current_bid,
        playing_format: (player.batting !== 'no' && player.bowling !== 'no') ? 'Allrounder' : (player.batting !== 'no' ? 'Batting' : 'Bowling'),
        is_wicket_keeper: player.wicket_keeper === 'yes',
        batting_style: player.batting + ' Hand',
        bowling_style: player.bowling + ' Bowl'
    }]);

    if (squadError) return alert("Squad Error: " + squadError.message);

    // 4. Update Team Spent Points (Increment)
    const newSpent = (team.spent_points || 0) + settings.current_bid;
    await supabaseClient.from('points_table').update({ spent_points: newSpent }).eq('id', team.id);

    // 5. Update Player Status & Price
    await supabaseClient.from('player_registrations')
        .update({ status: 'sold', auction_price: settings.current_bid })
        .eq('id', settings.current_player_id);

    // 6. Update Auction Status
    await supabaseClient.from('auction_settings').update({ status: 'sold' }).eq('id', 'global');

    alert(`✅ ${player.player_name} SOLD to ${team.team_name} for ₹${settings.current_bid.toLocaleString()}!`);
    fetchAdminAuctionState();
}

async function directSale() {
    const teamName = document.getElementById('direct-sell-team').value;
    const amountStr = document.getElementById('direct-sell-amount').value;
    const amount = parseInt(amountStr);

    if (!teamName) return alert("Select a team for direct sale!");
    if (!amountStr || isNaN(amount) || amount <= 0) return alert("Enter a valid amount!");

    // Check if there is a player on the board
    const { data: settings } = await supabaseClient.from('auction_settings').select('current_player_id').eq('id', 'global').single();
    if (!settings || !settings.current_player_id) {
        return alert("No active player on the auction board! Put a player on the board first.");
    }

    if (!confirm(`Are you sure you want to directly sell this player to ${teamName} for ₹${amount}?`)) return;

    try {
        // 1. Get Team ID
        const { data: team } = await supabaseClient.from('points_table').select('*').eq('team_name', teamName).single();
        if (!team) return alert("Selected team not found in database!");

        // 2. Get Player Name
        const { data: player } = await supabaseClient.from('player_registrations').select('*').eq('id', settings.current_player_id).single();

        // 2.5 Safe Clearance: Ensure any ghost records are removed before assignment
        console.log("🧹 Clearing any existing squad records for this player...");
        await supabaseClient.from('team_players').delete().eq('reg_no', player.registration_no);

        // 3. Insert into team_players
        const { error: squadError } = await supabaseClient.from('team_players').insert([{
            team_id: team.id,
            team_name: team.team_name,
            player_name: player.player_name,
            reg_no: player.registration_no,
            bid_amount: amount,
            playing_format: (player.batting !== 'no' && player.bowling !== 'no') ? 'Allrounder' : (player.batting !== 'no' ? 'Batting' : 'Bowling'),
            is_wicket_keeper: player.wicket_keeper === 'yes',
            batting_style: player.batting + ' Hand',
            bowling_style: player.bowling + ' Bowl'
        }]);

        if (squadError) return alert("Squad Error: " + squadError.message);

        // 4. Update Team Spent Points (Increment)
        const newSpent = (team.spent_points || 0) + amount;
        await supabaseClient.from('points_table').update({ spent_points: newSpent }).eq('id', team.id);

        // 5. Update Player Status & Price
        await supabaseClient.from('player_registrations')
            .update({ status: 'sold', auction_price: amount })
            .eq('id', settings.current_player_id);

        // 6. Update Auction Status
        await supabaseClient.from('auction_settings').update({ status: 'sold' }).eq('id', 'global');

        alert(`✅ ${player.player_name} DIRECT SOLD to ${team.team_name} for ₹${amount.toLocaleString()}!`);

        // Reset the inputs
        document.getElementById('direct-sell-team').value = "";
        document.getElementById('direct-sell-amount').value = "";

        fetchAdminAuctionState();
    } catch (e) {
        console.error(e);
        alert("Error during direct sale: " + e.message);
    }
}
// ================= AUCTION RESULTS MANAGEMENT =================

async function fetchAuctionResults() {
    const list = document.getElementById('admin-auction-results-list');
    if (!list) return;

    list.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-dim); padding: 20px;">Fetching results...</td></tr>';

    try {
        const { data: players, error } = await supabaseClient
            .from('player_registrations')
            .select('*')
            .or('status.eq.sold,status.eq.unsold')
            .order('player_name');

        if (error) throw error;

        if (!players || players.length === 0) {
            list.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-dim); padding: 20px;">No sold/unsold players found</td></tr>';
            return;
        }

        // Also fetch team assignments for sold players
        const { data: squad } = await supabaseClient.from('team_players').select('reg_no, team_name, bid_amount');

        list.innerHTML = players.map(p => {
            const assignment = squad ? squad.find(s => s.reg_no === p.registration_no) : null;
            const statusColor = p.status === 'sold' ? '#22c55e' : '#ef4444';
            const salePrice = assignment ? (assignment.bid_amount || p.auction_price) : (p.auction_price || '---');
            const teamDisplay = assignment ? assignment.team_name : (p.status === 'unsold' ? '---' : 'Checking...');

            return `
                <tr>
                    <td style="font-size: 0.8rem; font-family: monospace;">${p.registration_no}</td>
                    <td style="font-weight: 700;">${p.player_name}</td>
                    <td style="color: ${statusColor}; font-weight: 800;">${p.status.toUpperCase()}</td>
                    <td>${p.status === 'sold' ? '₹' + (salePrice ? salePrice.toLocaleString() : '---') : '---'}</td>
                    <td style="color: var(--secondary); font-weight: 600;">${teamDisplay}</td>
                    <td style="display: flex; gap: 8px;">
                        <button class="btn" style="background: var(--secondary); color: var(--bg-dark); font-size: 0.7rem; padding: 5px 10px; border: none; font-weight: 800;" 
                            onclick="openEditAuctionModal('${p.id}', '${p.registration_no}', '${(p.player_name || '').replace(/'/g, "\\'")}', '${p.status}', ${salePrice || 0}, '${assignment ? assignment.team_name : ''}')">EDIT</button>
                        <button class="btn" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; font-size: 0.7rem; padding: 5px 10px; border: 1px solid #ef4444;" 
                            onclick="releasePlayer('${p.id}', '${p.registration_no}')">RELEASE</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error("Results fetch error:", err);
        list.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 20px;">Error loading results: ${err.message}</td></tr>`;
    }
}

async function releasePlayer(playerId, regNo) {
    if (!confirm(`Are you sure you want to release ${regNo}? \nThis will reset their status and remove them from any assigned squad.`)) return;

    try {
        // 1. Get current assignment details for refund
        const { data: assignment } = await supabaseClient
            .from('team_players')
            .select('team_id, bid_amount')
            .eq('reg_no', regNo)
            .maybeSingle();

        // 2. Reset Status in registrations
        const { error: regErr } = await supabaseClient
            .from('player_registrations')
            .update({ status: 'paid', auction_price: null }) // Back to paid pool
            .eq('id', playerId);

        if (regErr) throw regErr;

        // 3. Remove from team_players
        await supabaseClient.from('team_players').delete().eq('reg_no', regNo);

        // 4. Trigger Budget Recalculation (Reliable approach)
        await syncTeamBudgetsFromSquads();

        alert("✅ Player released and budget refunded successfully!");
        fetchAuctionResults();
        if (typeof loadDashboard === 'function') loadDashboard();
    } catch (err) {
        alert("Release Error: " + err.message);
    }
}

async function syncAllTeamBudgets() {
    if (!confirm("Are you sure you want to recalculate all team budgets based on current squads?")) return;

    try {
        // 1. Get all teams
        const { data: teams } = await supabaseClient.from('points_table').select('id, team_name');
        // 2. Get all assigned players
        const { data: squadPlayers } = await supabaseClient.from('team_players').select('team_id, bid_amount');

        if (!teams) return;

        console.log("Recalculating budgets...");

        for (const team of teams) {
            const teamSpent = squadPlayers
                ? squadPlayers
                    .filter(p => p.team_id === team.id)
                    .reduce((sum, p) => sum + (p.bid_amount || 0), 0)
                : 0;

            await supabaseClient.from('points_table').update({ spent_points: teamSpent }).eq('id', team.id);
        }

        alert("✅ All team budgets synchronized successfully!");
        fetchAdminPoints();
        if (typeof loadDashboard === 'function') loadDashboard();
    } catch (err) {
        alert("Sync Error: " + err.message);
    }
}

// ================= DIRECT FILE UPLOAD LOGIC =================
let directUploadPlayerId = null;

function triggerDirectUpload(playerId) {
    directUploadPlayerId = playerId;
    document.getElementById('direct-file-upload').click();
}

async function processDirectUpload(input) {
    if (!input.files || input.files.length === 0 || !directUploadPlayerId) return;

    const file = input.files[0];
    const playerId = directUploadPlayerId;

    // Reset for next time
    directUploadPlayerId = null;
    input.value = '';

    const originalText = "Uploading...";
    console.log(`Starting direct upload for player ${playerId}...`);

    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { data, error: uploadError } = await supabaseClient.storage
            .from('player-photos')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabaseClient.storage
            .from('player-photos')
            .getPublicUrl(filePath);

        const { error: updateError } = await supabaseClient
            .from('player_registrations')
            .update({ photo_url: publicUrl })
            .eq('id', playerId);

        if (updateError) throw updateError;

        alert("✅ File uploaded and updated successfully!");
        fetchRegistrations(); // Refresh the list
    } catch (err) {
        alert("Upload Error: " + err.message);
        console.error(err);
    }
}
let cropper = null;
let currentEditingId = null;

async function openPhotoEditor(id, photoUrl) {
    if (!photoUrl || photoUrl === 'null' || photoUrl === 'undefined') return alert("This player has no photo to edit.");

    currentEditingId = id;
    const modal = document.getElementById('photo-editor-modal');
    const image = document.getElementById('editor-image');

    // Set crossOrigin to avoid Tainted Canvas errors when cropping
    image.crossOrigin = 'anonymous';
    image.src = photoUrl + '?t=' + new Date().getTime(); // Cache busting

    modal.style.display = 'block';

    // Wait for image to load before initializing cropper
    image.onload = () => {
        if (cropper) {
            cropper.destroy();
        }

        cropper = new Cropper(image, {
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 0.8,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
        });
    };
}

function rotateImage(deg) {
    if (cropper) cropper.rotate(deg);
}

function flipImage(dir) {
    if (!cropper) return;
    const data = cropper.getData();
    if (dir === 'h') cropper.scaleX(data.scaleX * -1);
    else cropper.scaleY(data.scaleY * -1);
}

function resetEditor() {
    if (cropper) cropper.reset();
}

function closePhotoEditor() {
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    document.getElementById('photo-editor-modal').style.display = 'none';
    currentEditingId = null;
}

async function saveEditedPhoto() {
    if (!cropper || !currentEditingId) return;

    const saveBtn = document.getElementById('save-photo-btn');
    const originalText = saveBtn.innerText;
    saveBtn.disabled = true;
    saveBtn.innerText = "Processing... ⏳";

    try {
        // 1. Get cropped canvas
        const canvas = cropper.getCroppedCanvas({
            maxWidth: 1024,
            maxHeight: 1024,
            imageSmoothingQuality: 'high'
        });

        // 2. Convert to Blob
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));

        // 3. Generate filename
        const fileName = `edited_${currentEditingId}_${Date.now()}.jpg`;
        const filePath = `player_photos/${fileName}`;

        // 4. Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseClient
            .storage
            .from('player-photos')
            .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });

        if (uploadError) throw uploadError;

        // 5. Get Public URL
        const { data: urlData } = supabaseClient.storage.from('player-photos').getPublicUrl(filePath);
        const newUrl = urlData.publicUrl;

        // 6. Update Database
        const { error: dbError } = await supabaseClient
            .from('player_registrations')
            .update({ photo_url: newUrl })
            .eq('id', currentEditingId);

        if (dbError) throw dbError;

        alert("✅ Photo updated successfully!");
        closePhotoEditor();
        if (typeof fetchRegistrations === 'function') fetchRegistrations();

    } catch (err) {
        console.error("Save Error:", err);
        alert("Error saving photo: " + (err.message || "Unknown error"));
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = originalText;
    }
}

async function syncTeamBudgetsFromSquads() {
    console.log("🔄 Reconciling Team Budgets from Squads...");

    // 1. Fetch squads and teams
    const { data: squadPlayers } = await supabaseClient.from('team_players').select('team_id, bid_amount');
    const { data: teams } = await supabaseClient.from('points_table').select('id, team_name, budget');

    if (!teams) return;

    // 2. Sum up bids for each team
    const spentMap = {};
    teams.forEach(t => spentMap[t.id] = 0);

    if (squadPlayers) {
        squadPlayers.forEach(p => {
            if (spentMap[p.team_id] !== undefined) {
                spentMap[p.team_id] += (p.bid_amount || 0);
            }
        });
    }

    // 3. Update each team in Supabase
    for (const teamId of Object.keys(spentMap)) {
        const currentTeam = teams.find(t => t.id == teamId);
        const updates = { spent_points: spentMap[teamId] };

        // If budget is weird (like 3660), reset it to 4000
        if (currentTeam && currentTeam.budget < 1000) {
            updates.budget = 4000;
        }

        await supabaseClient.from('points_table').update(updates).eq('id', teamId);
    }

    if (typeof fetchAdminPoints === 'function') fetchAdminPoints();
}
// ================= EDIT AUCTION RESULT =================

async function openEditAuctionModal(playerId, regNo, name, status, amount, teamName) {
    const modal = document.getElementById('edit-auction-modal');
    document.getElementById('edit-auction-player-id').value = playerId;
    document.getElementById('edit-auction-reg-no').value = regNo;
    document.getElementById('edit-auction-player-info').innerText = `${name} (${regNo})`;
    document.getElementById('edit-auction-status').value = status;
    document.getElementById('edit-auction-price').value = amount || 0;

    // Store old values for budget adjustment
    document.getElementById('edit-auction-old-amount').value = amount || 0;

    // Populate teams and select current one
    const teamSelect = document.getElementById('edit-auction-team');
    teamSelect.innerHTML = '<option value="">Select Team</option>';

    const { data: teams } = await supabaseClient.from('points_table').select('id, team_name').order('team_name');
    if (teams) {
        teams.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.innerText = t.team_name;
            if (t.team_name === teamName) {
                opt.selected = true;
                document.getElementById('edit-auction-old-team-id').value = t.id;
            }
            teamSelect.appendChild(opt);
        });
    }

    toggleEditAuctionTeamPrice();
    modal.style.display = 'flex';
}

function toggleEditAuctionTeamPrice() {
    const status = document.getElementById('edit-auction-status').value;
    const fields = document.getElementById('edit-auction-sale-fields');
    fields.style.display = (status === 'sold') ? 'block' : 'none';
}

async function saveAuctionEdit() {
    console.log("🚀 [DEBUG V3] saveAuctionEdit triggered");
    const playerId = document.getElementById('edit-auction-player-id').value;
    const regNo = document.getElementById('edit-auction-reg-no').value;
    const newStatus = document.getElementById('edit-auction-status').value;
    const newAmount = parseInt(document.getElementById('edit-auction-price').value) || 0;
    const newTeamId = document.getElementById('edit-auction-team').value;

    console.log(`🔍 [DEBUG V3] Details: ID=${playerId}, Reg=${regNo}, Status=${newStatus}, Team=${newTeamId}, Amount=${newAmount}`);

    const oldAmount = parseInt(document.getElementById('edit-auction-old-amount').value) || 0;
    const oldTeamId = document.getElementById('edit-auction-old-team-id').value;

    try {
        // 1. Update Registration Status
        console.log("⏳ [DEBUG V3] Updating player_registrations...");
        const { error: regErr } = await supabaseClient
            .from('player_registrations')
            .update({
                status: newStatus,
                auction_price: (newStatus === 'sold' ? newAmount : null)
            })
            .eq('id', playerId);
        if (regErr) throw regErr;

        // 2. Handle Team Assignments
        if (newStatus === 'sold') {
            if (!newTeamId) {
                alert("Please select a team for SOLD status");
                return;
            }

            console.log("⏳ [DEBUG V3] Fetching Team and Player metadata...");
            const { data: teamData } = await supabaseClient.from('points_table').select('team_name').eq('id', newTeamId).single();
            const teamName = teamData ? teamData.team_name : 'Unknown';

            // Fetch FULL player data to satisfy all not-null constraints in team_players
            let { data: player } = await supabaseClient.from('player_registrations').select('*').eq('id', playerId).maybeSingle();

            // Fallback to Reg No if ID fails
            if (!player && regNo) {
                console.warn("⚠️ [DEBUG V3] Player not found by ID, trying Reg No...");
                const { data: pByReg } = await supabaseClient.from('player_registrations').select('*').eq('registration_no', regNo).maybeSingle();
                player = pByReg;
            }

            if (!player) throw new Error("Could not find player data for: " + (regNo || playerId));
            console.log("✅ [DEBUG V3] Player Name Found:", player.player_name);

            // Safe approach: Delete existing assignment first
            console.log("⏳ [DEBUG V3] Deleting existing squad entry...");
            await supabaseClient.from('team_players').delete().eq('reg_no', regNo);

            // Insert new assignment with all required metadata
            console.log("⏳ [DEBUG V3] Inserting new squad entry...");
            const { error: squadErr } = await supabaseClient
                .from('team_players')
                .insert([{
                    reg_no: regNo,
                    player_name: player.player_name,
                    team_id: newTeamId,
                    team_name: teamName,
                    bid_amount: newAmount,
                    playing_format: (player.batting !== 'no' && player.bowling !== 'no') ? 'Allrounder' : (player.batting !== 'no' ? 'Batting' : 'Bowling'),
                    is_wicket_keeper: player.wicket_keeper === 'yes' || player.wicket_keeper === true,
                    batting_style: (player.batting || 'Right') + ' Hand',
                    bowling_style: (player.bowling || 'Right') + ' Bowl'
                }]);

            if (squadErr) {
                console.error("❌ [DEBUG V3] Squad Insert Error:", squadErr);
                throw squadErr;
            }

        } else {
            // Remove from squad if not sold
            await supabaseClient.from('team_players').delete().eq('reg_no', regNo);
        }

        // 3. Trigger Budget Recalculation
        // 3. Trigger Budget Recalculation
        console.log("⏳ [DEBUG V3] Syncing budgets...");
        await syncTeamBudgetsFromSquads();

        alert("Auction result updated successfully! ✨");
        document.getElementById('edit-auction-modal').style.display = 'none';
        fetchAuctionResults();

    } catch (err) {
        console.error("❌ [DEBUG V3] CRITICAL ERROR:", err);
        alert("Error saving changes: " + err.message);
    }
}

// ================= DATABASE MAINTENANCE =================

async function cleanupOrphanedSquads() {
    if (!confirm("This will find players who are NOT 'Sold' but still have a team assignment and remove them from squads. Continue?")) return;

    try {
        console.log("🧹 Starting Squad Cleanup...");

        // 1. Fetch all assigned players
        const { data: assignments, error: assignedErr } = await supabaseClient
            .from('team_players')
            .select('reg_no, player_name');

        if (assignedErr) throw assignedErr;
        if (!assignments || assignments.length === 0) {
            alert("No assignments found to check.");
            return;
        }

        // 2. Fetch all registered players who are NOT sold
        const { data: nonSoldPlayers, error: nonSoldErr } = await supabaseClient
            .from('player_registrations')
            .select('registration_no')
            .neq('status', 'sold');

        if (nonSoldErr) throw nonSoldErr;

        const nonSoldRegNos = new Set(nonSoldPlayers.map(p => p.registration_no));
        const orphanedRegNos = assignments
            .filter(a => nonSoldRegNos.has(a.reg_no))
            .map(a => a.reg_no);

        if (orphanedRegNos.length === 0) {
            alert("Everything looks clean! No orphaned assignments found. ✨");
            return;
        }

        console.log(`🗑️ Found ${orphanedRegNos.length} orphaned assignments. Deleting...`);

        // 3. Delete orphaned records
        const { error: delErr } = await supabaseClient
            .from('team_players')
            .delete()
            .in('reg_no', orphanedRegNos);

        if (delErr) throw delErr;

        // 4. Recalculate budgets
        await syncTeamBudgetsFromSquads();

        alert(`✅ Cleanup successful! Removed ${orphanedRegNos.length} orphaned assignments and updated budgets.`);
        fetchAuctionResults();
        if (typeof fetchAdminRoster === 'function') fetchAdminRoster();

    } catch (err) {
        console.error("Cleanup Error:", err);
        alert("Cleanup failed: " + err.message);
    }
}

// ================= SCORER MANAGEMENT =================

async function fetchScorers() {
    const list = document.getElementById('admin-scorers-list');
    if (!list) return;

    list.innerHTML = '<tr><td colspan="5" style="text-align: center;">Loading Scorers...</td></tr>';

    try {
        const { data, error } = await supabaseClient
            .from('scorers')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            list.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-dim);">No scorer accounts found.</td></tr>';
            return;
        }

        list.innerHTML = data.map(s => `
            <tr class="animate-fade">
                <td style="font-weight: 700;">${s.name || 'N/A'}</td>
                <td style="color: var(--secondary); font-family: monospace;">${s.username}</td>
                <td style="color: var(--text-dim);">${s.password}</td>
                <td style="font-size: 0.8rem; color: var(--text-dim);">${new Date(s.created_at).toLocaleDateString()}</td>
                <td>
                    <button class="btn-scoring" style="background: rgba(239, 68, 68, 0.1); color: #ef4444;" 
                        onclick="deleteScorer('${s.id}')">Delete</button>
                </td>
            </tr>
        `).join('');

    } catch (err) {
        console.error("Fetch Scorers Error:", err);
        list.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #ef4444;">Error: ${err.message}</td></tr>`;
    }
}

function openScorerModal() {
    // Reset fields
    document.getElementById('scorer-name').value = '';
    document.getElementById('scorer-username').value = '';
    document.getElementById('scorer-password').value = '';

    document.getElementById('add-scorer-modal').style.display = 'flex';
}

async function saveNewScorer() {
    const name = document.getElementById('scorer-name').value.trim();
    const username = document.getElementById('scorer-username').value.trim();
    const password = document.getElementById('scorer-password').value.trim();

    if (!username || !password) {
        alert("Username and Password are required!");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('scorers')
            .insert([{ name, username, password }]);

        if (error) throw error;

        alert("Scorer account created successfully! 🎉");
        document.getElementById('add-scorer-modal').style.display = 'none';
        fetchScorers();
    } catch (err) {
        console.error("Save Scorer Error:", err);
        alert("Failed to create scorer: " + (err.message.includes("unique") ? "Username already exists!" : err.message));
    }
}

async function deleteScorer(id) {
    if (!confirm("Are you sure you want to delete this scorer account?")) return;

    try {
        const { error } = await supabaseClient
            .from('scorers')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert("Scorer account deleted.");
        fetchScorers();
    } catch (err) {
        console.error("Delete Scorer Error:", err);
        alert("Failed to delete scorer: " + err.message);
    }
}

// ================= SPONSOR MANAGEMENT (GLOBAL) =================

async function fetchSponsors() {
    const { data, error } = await supabaseClient.from('sponsors').select('*').order('priority', { ascending: false });
    if (error) return console.error('Sponsor fetch error:', error);

    const tbody = document.getElementById('sponsors-table-body');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-dim); padding: 40px;">No sponsors added yet. Click "+ Add New Sponsor" to get started.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(s => `
        <tr>
            <td>${s.logo_url ? `<img src="${s.logo_url}" style="height: 40px; border-radius: 5px; object-fit: contain;">` : '---'}</td>
            <td><strong>${s.name}</strong></td>
            <td>${s.priority}</td>
            <td><span class="status-badge ${s.is_active ? 'paid' : 'pending'}">${s.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>
                <button class="btn-secondary" style="margin-right:5px;" onclick="openEditSponsorModal('${s.id}')">Edit</button>
                <button class="btn-scoring" style="background: rgba(239,68,68,0.1); color: #ef4444;" onclick="deleteSponsor('${s.id}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

function openAddSponsorModal() {
    document.getElementById('sponsor-form').reset();
    document.getElementById('sponsor-id').value = '';
    document.getElementById('sponsor-active').checked = true;
    document.getElementById('sponsor-modal').style.display = 'flex';
}

function closeSponsorModal() {
    document.getElementById('sponsor-modal').style.display = 'none';
}

async function openEditSponsorModal(id) {
    const { data } = await supabaseClient.from('sponsors').select('*').eq('id', id).single();
    if (data) {
        document.getElementById('sponsor-id').value = data.id;
        document.getElementById('sponsor-name').value = data.name;
        document.getElementById('sponsor-logo').value = data.logo_url || '';
        document.getElementById('sponsor-priority').value = data.priority || 0;
        document.getElementById('sponsor-active').checked = data.is_active;
        document.getElementById('sponsor-modal').style.display = 'flex';
    }
}

async function saveSponsor(e) {
    e.preventDefault();
    const id = document.getElementById('sponsor-id').value;
    const sponsorData = {
        name: document.getElementById('sponsor-name').value,
        logo_url: document.getElementById('sponsor-logo').value || null,
        priority: parseInt(document.getElementById('sponsor-priority').value) || 0,
        is_active: document.getElementById('sponsor-active').checked
    };

    let error;
    if (id) {
        ({ error } = await supabaseClient.from('sponsors').update(sponsorData).eq('id', id));
    } else {
        ({ error } = await supabaseClient.from('sponsors').insert([sponsorData]));
    }

    if (error) {
        alert("Error saving sponsor: " + error.message);
    } else {
        showToast("Sponsor saved successfully!", "success");
        closeSponsorModal();
        fetchSponsors();
    }
}

async function deleteSponsor(id) {
    if (!confirm("Are you sure you want to delete this sponsor?")) return;
    const { error } = await supabaseClient.from('sponsors').delete().eq('id', id);
    if (error) alert("Error: " + error.message);
    else {
        showToast("Sponsor deleted.", "success");
        fetchSponsors();
    }
}
