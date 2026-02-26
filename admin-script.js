// ================= AUTH CHECK =================
async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = "admin-login.html";
    }
}
// checkAuth(); // We will call this in init

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
        if (sectionId === 'points') fetchAdminPoints();
        if (sectionId === 'scoring') loadScoringSection();
        if (sectionId === 'gallery') fetchGallery();
        if (sectionId === 'menu') fetchAdminMenu();
        if (sectionId === 'results') fetchResults();
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

    const { data, error } = await supabaseClient
        .from("hero_content")
        .select("*")
        .eq("id", dbId)
        .single();

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

    const { error } = await supabaseClient.from("hero_content").upsert([updates]);

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
    const { data } = await supabaseClient
        .from("nav_menu")
        .select("*")
        .order("order_index", { ascending: true });

    if (data && data.length > 0) {
        list.innerHTML = data.map(item => createMenuRowHtml(item)).join("");
    } else {
        // Auto-populate with default items if DB is empty
        console.warn("No nav items found, seeding defaults...");
        const defaults = [
            { label: 'Home', link: 'index.html', order_index: 1, is_active: true },
            { label: 'Fixtures', link: 'fixtures.html', order_index: 2, is_active: true },
            { label: 'Register Now', link: 'registration.html', order_index: 3, is_active: true },
        ];
        list.innerHTML = defaults.map(item => createMenuRowHtml(item)).join("");
        // Auto-save defaults to the DB
        await supabaseClient.from("nav_menu").insert(defaults);
        console.log("✅ Default nav items seeded to database.");
    }
}

function createMenuRowHtml(item = { id: '', label: '', link: '', order_index: 0, is_active: true }) {
    return `
        <tr data-id="${item.id || ''}">
            <td><input type="number" class="table-input menu-order" value="${item.order_index}" style="width: 60px;"></td>
            <td><input type="text" class="table-input menu-label" value="${item.label}" placeholder="Label"></td>
            <td><input type="text" class="table-input menu-link" value="${item.link}" placeholder="URL"></td>
            <td>
                <select class="table-input menu-active">
                    <option value="true" ${item.is_active ? 'selected' : ''}>Active</option>
                    <option value="false" ${!item.is_active ? 'selected' : ''}>Hidden</option>
                </select>
            </td>
            <td>
                <button onclick="this.closest('tr').remove()" class="btn-secondary" style="background: #ef4444; border: none; padding: 5px 10px;">Del</button>
            </td>
        </tr>
    `;
}

function addMenuRow() {
    const list = document.getElementById("admin-menu-list");
    list.insertAdjacentHTML('beforeend', createMenuRowHtml());
}

async function saveMenu() {
    const rows = document.querySelectorAll("#admin-menu-list tr");
    const menuItems = Array.from(rows).map(row => ({
        label: row.querySelector(".menu-label").value,
        link: row.querySelector(".menu-link").value,
        order_index: parseInt(row.querySelector(".menu-order").value) || 0,
        is_active: row.querySelector(".menu-active").value === 'true'
    }));

    // Logic: Delete all and re-insert is easier for small lists
    await supabaseClient.from("nav_menu").delete().not('id', 'is', null);

    const { error } = await supabaseClient.from("nav_menu").insert(menuItems);

    if (error) {
        alert("Error saving menu: " + error.message);
    } else {
        alert("Menu Updated Successfully! Refresh your site to see changes.");
        fetchAdminMenu();
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

    const { data, error } = await query;
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
                    <a href="${encodeURI(player.photo_url)}" target="_blank">
                        <img src="${encodeURI(player.photo_url)}" style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover; border: 1px solid var(--glass-border); cursor: pointer;" title="Click to view full size">
                    </a>
                ` : '<span style="color: var(--text-dim)">No Photo</span>'}
            </td>
            <td>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button onclick="openEditModal('${player.id}')" class="btn" style="font-size: 0.75rem; padding: 5px 10px; background: #3b82f6;">Edit</button>
                    ${player.token || player.registration_no ? `
                        <a href="success.html?id=${player.token || player.registration_no}" target="_blank" class="btn" style="font-size: 0.75rem; padding: 5px 10px; background: var(--secondary); color: var(--bg-dark); text-decoration: none;">View ID</a>
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
        const { data: updated, error } = await supabaseClient
            .from("player_registrations")
            .update({ payment_status: status })
            .eq("id", id)
            .select();

        if (error) throw error;

        // If newly paid and has no registration_no, generate it
        if (status === 'paid' && updated && updated[0] && !updated[0].registration_no) {
            const playerRow = updated[0];
            const serialNum = parseInt(playerRow.reg_serial);
            if (!isNaN(serialNum)) {
                const registrationNo = `OSATPL01S${(serialNum + 2000).toString().padStart(4, "0")}`;
                console.log("Confirmed Reg No:", registrationNo, "from Serial:", serialNum);

                const { error: regError } = await supabaseClient
                    .from("player_registrations")
                    .update({ registration_no: registrationNo })
                    .eq("id", id);

                if (regError) console.warn("Error generating reg_no:", regError.message);
            }
        }

        fetchRegistrations();
    } catch (err) {
        alert("Error: " + err.message);
    }
}

async function deleteRegistration(id) {
    if (!confirm("Delete this registration?")) return;
    await supabaseClient.from("player_registrations").delete().eq("id", id);
    fetchRegistrations();
}

// ================= EDIT MODAL LOGIC =================
function closeEditModal() {
    document.getElementById("edit-modal").style.display = "none";
}

async function openEditModal(id) {
    console.log("🛠️ Attempting to open edit modal for ID:", id);
    const { data, error } = await supabaseClient
        .from("player_registrations")
        .select("*")
        .eq("id", id)
        .single();

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

    const { error } = await supabaseClient
        .from("player_registrations")
        .update(updates)
        .eq("id", id);

    if (error) {
        alert("Update Failed: " + error.message);
    } else {
        alert("Registration Updated Successfully!");
        closeEditModal();
        fetchRegistrations();
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
        const { data: existing, error: checkError } = await supabaseClient
            .from("player_registrations")
            .select("id")
            .or(`mobile_number.eq.${mobile},aadhar_number.eq.${aadhar}`)
            .maybeSingle();

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
        const { data: inserted, error: insertError } = await supabaseClient
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
            .select();

        if (insertError) throw new Error("Database Save Failed: " + insertError.message);

        // 4. Generate Reg No (Robust Numeric Logic using reg_serial)
        const playerRow = inserted[0];
        const serialNum = parseInt(playerRow.reg_serial);

        if (isNaN(serialNum)) {
            throw new Error("ID Generation Error: Serial number is invalid.");
        }

        const registrationNo = `OSATPL01S${(serialNum + 2000).toString().padStart(4, "0")}`;
        console.log("Manual Reg No Generated:", registrationNo, "from Serial:", serialNum);

        const { error: updateError } = await supabaseClient
            .from("player_registrations")
            .update({ registration_no: registrationNo })
            .eq("id", playerRow.id);

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

// ================= POINTS TABLE =================
async function fetchAdminPoints() {
    const list = document.getElementById("admin-points-list");
    const { data, error } = await supabaseClient
        .from("points_table")
        .select("*")
        .order("points", { ascending: false });

    if (error) {
        console.error('Error loading points table:', error);
        list.innerHTML = `<tr><td colspan="6" style="color: #ff4d8d;">Error loading points: ${error.message}</td></tr>`;
        return;
    }

    if (!data || data.length === 0) {
        console.warn('Points table is empty');
        list.innerHTML = `<tr><td colspan="6" style="color: var(--text-dim);">No data found in points table.</td></tr>`;
        return;
    }

    console.log("Points Table Data Loaded:", data);

    list.innerHTML = data.map(team => `
        <tr data-id="${team.id}">
            <td><input type="text" value="${team.group_name || 'A'}" class="table-input group-input" style="width: 50px; text-align: center; font-weight: 800;"></td>
            <td><input type="text" value="${team.team_name || ''}" class="table-input team-name-input"></td>
            <td>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
                    ${team.logo_url ? `<img src="${team.logo_url}" onclick="previewTeam('${team.id}')" class="logo-preview" style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover; cursor: pointer; border: 2px solid var(--secondary); transition: 0.3s;" title="Click to preview">` : `<div onclick="previewTeam('${team.id}')" style="width:35px; height:35px; background:rgba(255,255,255,0.1); border-radius:50%; cursor: pointer;" title="Click to preview"></div>`}
                    <input type="file" class="logo-upload-input" accept="image/png, image/jpeg" style="font-size: 0.6rem; width: 100px;">
                    <input type="hidden" value="${team.logo_url || ''}" class="logo-url-hidden">
                </div>
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="text" value="${team.owner_name || ''}" class="table-input owner-input">
                    <button onclick="previewTeam('${team.id}')" class="btn-secondary" style="padding: 5px; min-width: 35px; border-radius: 8px;" title="Quick View">👁️</button>
                </div>
            </td>
            <td><input type="number" value="${team.played}" class="table-input played-input" oninput="calculateStats(this)"></td>
            <td><input type="number" value="${team.won}" class="table-input won-input" oninput="calculateStats(this)"></td>
            <td><input type="number" value="${team.lost}" class="table-input lost-input" oninput="calculateStats(this)"></td>
            <td><input type="number" value="${team.runs_scored || 0}" class="table-input rs-input" oninput="calculateStats(this)"></td>
            <td><input type="number" value="${team.overs_faced || 0}" step="0.1" class="table-input of-input" oninput="calculateStats(this)"></td>
            <td><input type="number" value="${team.runs_conceded || 0}" class="table-input rc-input" oninput="calculateStats(this)"></td>
            <td><input type="number" value="${team.overs_bowled || 0}" step="0.1" class="table-input ob-input" oninput="calculateStats(this)"></td>
            <td><input type="number" value="${team.nrr || 0}" class="table-input nrr-input" readonly style="background: rgba(0,0,0,0.1);"></td>
            <td><input type="number" value="${team.points}" class="table-input points-input" readonly style="font-weight: bold; color: var(--secondary); background: rgba(0,0,0,0.2); cursor: not-allowed;"></td>
        </tr>
    `).join("");
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
    logoImg.src = data.logo_url || "img.svg";
    teamNameEl.innerText = data.team_name || "Unknown Team";
    ownerNameEl.innerText = data.owner_name || "Not Set";
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
    const originalText = saveBtn.innerText;

    saveBtn.innerText = "⏳ Saving & Uploading...";
    saveBtn.disabled = true;

    try {
        const updates = await Promise.all(Array.from(rows).map(async (row) => {
            const fileInput = row.querySelector(".logo-upload-input");
            let logoUrl = row.querySelector(".logo-url-hidden").value;

            // Handle New Upload if file selected
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const timestamp = Date.now();
                const fileName = `logo_${timestamp}_${Math.floor(Math.random() * 1000)}.png`;

                const { error: uploadError } = await supabaseClient.storage
                    .from("player-photos") // Re-using existing bucket
                    .upload(fileName, file);

                if (!uploadError) {
                    const { data: photoData } = supabaseClient.storage
                        .from("player-photos")
                        .getPublicUrl(fileName);
                    logoUrl = photoData.publicUrl;
                } else {
                    console.error("Logo Upload Error:", uploadError);
                }
            }

            return {
                id: parseInt(row.dataset.id),
                group_name: row.querySelector(".group-input").value.trim().toUpperCase(),
                team_name: row.querySelector(".team-name-input").value,
                logo_url: logoUrl,
                owner_name: row.querySelector(".owner-input").value,
                played: parseInt(row.querySelector(".played-input").value) || 0,
                won: parseInt(row.querySelector(".won-input").value) || 0,
                lost: parseInt(row.querySelector(".lost-input").value) || 0,
                runs_scored: parseInt(row.querySelector(".rs-input").value) || 0,
                overs_faced: parseFloat(row.querySelector(".of-input").value) || 0,
                runs_conceded: parseInt(row.querySelector(".rc-input").value) || 0,
                overs_bowled: parseFloat(row.querySelector(".ob-input").value) || 0,
                nrr: parseFloat(row.querySelector(".nrr-input").value) || 0,
                points: parseInt(row.querySelector(".points-input").value) || 0
            };
        }));

        const { error } = await supabaseClient.from("points_table").upsert(updates);

        if (error) {
            alert("Error saving: " + error.message);
        } else {
            showToast("Points Table & Logos Updated!", "success");
            fetchAdminPoints();
            loadRosterTeams();
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
        const { data, error } = await supabaseClient
            .from('player_registrations')
            .select('*')
            .eq('registration_no', regNo)
            .single();

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

        const tasks = [
            { name: "Hero", fn: loadHero },
            { name: "Registrations", fn: fetchRegistrations },
            { name: "Points", fn: fetchAdminPoints },
            { name: "Roster Teams", fn: loadRosterTeams },
            { name: "Settings", fn: loadSettings },
            { name: "Navigation Menu", fn: fetchAdminMenu },
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
    const [{ data: notices, error: noticeErr }, { data: settings }] = await Promise.all([
        supabaseClient.from('notices').select('*').order('created_at', { ascending: false }),
        supabaseClient.from('site_settings').select('featured_notice_id').eq('id', 'global-settings').single()
    ]);

    if (noticeErr) return;
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
    const { data, error } = await supabaseClient
        .from('notices')
        .select('*')
        .eq('id', id)
        .single();
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
        result = await supabaseClient.from('notices').update(noticeData).eq('id', id);
    } else {
        result = await supabaseClient.from('notices').insert([noticeData]);
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
    const { error } = await supabaseClient
        .from('site_settings')
        .update({ featured_notice_id: newId })
        .eq('id', 'global-settings');

    if (error) alert("Error pinning notice: " + error.message);
    else {
        alert(isUnpin ? "📌 Notice Unpinned!" : "📌 Notice Pinned to Popup!");
        fetchNotices();
    }
}

async function toggleNoticeStatus(id, current) {
    await supabaseClient.from('notices').update({ is_active: !current }).eq('id', id);
    fetchNotices();
}

async function deleteNotice(id) {
    if (!confirm("Are you sure?")) return;
    await supabaseClient.from('notices').delete().eq('id', id);
    fetchNotices();
}

// ================= FIXTURES (SCHEDULE) =================
async function fetchFixtures() {
    const { data, error } = await supabaseClient.from('fixtures').select('*').order('match_no', { ascending: true });
    if (error) return;
    const list = document.getElementById('admin-fixtures-list');
    if (!list) return;

    list.innerHTML = data.map(f => {
        const date = new Date(f.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
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
                    <div style="display: flex; gap: 5px;">
                        <button class="btn" style="padding: 5px 10px; font-size: 0.75rem; background: #3b82f6;" onclick='editFixture(${JSON.stringify(f)})'>Edit</button>
                        <button class="btn-secondary" style="background: #ef4444; border: none; padding: 5px 10px;" onclick="deleteFixture('${f.id}')">Del</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function openFixtureModal(isEdit = false) {
    document.getElementById('fixture-modal-title').innerText = isEdit ? 'Edit Match 🏏' : 'Add New Match 🏏';

    // Fetch teams for dropdowns
    const t1Select = document.getElementById('fix-t1');
    const t2Select = document.getElementById('fix-t2');

    const { data: teams } = await supabaseClient.from('points_table').select('team_name').order('team_name');
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

    let error;
    if (id) {
        const res = await supabaseClient.from('fixtures').update(updates).eq('id', id);
        error = res.error;
    } else {
        const res = await supabaseClient.from('fixtures').insert([updates]);
        error = res.error;
    }

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
        const { data: match } = await supabaseClient.from('fixtures').select('*').eq('id', id).single();
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
        const { data: regData, error: regErr } = await supabaseClient
            .from('player_registrations')
            .select('player_name')
            .eq('registration_no', regNo)
            .single();

        if (regErr || !regData) {
            alert("No player found with this Registration ID!");
            return;
        }

        document.getElementById('stat-name').value = regData.player_name;

        // 2. Search in team_players to get their Team Name
        const { data: teamPlayerData, error: teamErr } = await supabaseClient
            .from('team_players')
            .select('team_id')
            .eq('reg_no', regNo)
            .single();

        if (teamPlayerData && teamPlayerData.team_id) {
            const { data: teamData } = await supabaseClient
                .from('points_table')
                .select('team_name')
                .eq('id', teamPlayerData.team_id)
                .single();

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
        const res = await supabaseClient.from('top_performers').update(updates).eq('id', id);
        error = res.error;
    } else {
        const res = await supabaseClient.from('top_performers').insert([updates]);
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
    await supabaseClient.from('top_performers').delete().eq('id', id);
    fetchLeaderboard();
}

// ================= GALLERY MANAGER =================
async function fetchGallery() {
    console.log("📸 Fetching Gallery Photos...");
    const list = document.getElementById('admin-gallery-list');
    if (!list) return;

    const { data, error } = await supabaseClient
        .from('gallery')
        .select('*')
        .order('created_at', { ascending: false });

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

            const { error: dbError } = await supabaseClient
                .from('gallery')
                .insert([{
                    image_url: imageUrl,
                    orientation: orientation
                }]);

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

            const { error: dbError } = await supabaseClient
                .from('gallery')
                .update(updates)
                .eq('id', editId);

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
    }

    // Pre-fill top performers from live scoring state if it's the current live match
    if (m && m.status === 'upcoming' && liveMatchState.team_name) {
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
            top_bat: document.getElementById('res-top-bat').value,
            top_bat_runs: parseInt(document.getElementById('res-top-bat-runs').value) || 0,
            top_bowl: document.getElementById('res-top-bowl').value,
            top_bowl_wkts: parseInt(document.getElementById('res-top-bowl-wkts').value) || 0
        }).eq('id', id);

        // 2. Update Points Table Automatically (Full Sync)
        await syncPointsTableFromFixtures();

        // 3. Update Top Performers (Subtract OLD, Add NEW)
        if (oldM && oldM.status === 'completed') {
            if (oldM.top_bat) await updateTournamentCaps(oldM.top_bat, '', 'batsman', -oldM.top_bat_runs, 0);
            if (oldM.top_bowl) await updateTournamentCaps(oldM.top_bowl, '', 'bowler', 0, -oldM.top_bowl_wkts);
        }

        const topBat = document.getElementById('res-top-bat').value;
        const topBatRuns = parseInt(document.getElementById('res-top-bat-runs').value) || 0;
        const topBowl = document.getElementById('res-top-bowl').value;
        const topBowlWkts = parseInt(document.getElementById('res-top-bowl-wkts').value) || 0;

        if (topBat) await updateTournamentCaps(topBat, '', 'batsman', topBatRuns, 0);
        if (topBowl) await updateTournamentCaps(topBowl, '', 'bowler', 0, topBowlWkts);

        logActivity('Match', `Result updated: ${t1} vs ${t2}. Winner: ${winner}`);
        alert("✅ Result Saved, Points Table & Leaderboard Updated!");
        closeResultModal();
        fetchFixtures();
        fetchResults();
    } catch (e) {
        alert("Error saving result: " + e.message);
    }
}

async function updateTournamentCaps(name, team, cat, r, w) {
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
            team_name: team || existing.team_name
        }).eq('id', existing.id);
    } else {
        await supabaseClient.from('top_performers').insert([{
            player_name: name,
            team_name: team || 'Unknown',
            category: cat,
            runs: r,
            wickets: w
        }]);
    }
}

async function syncPointsTableFromFixtures() {
    console.log("🔄 Recalculating Points Table from all matches...");

    // 1. Fetch all completed fixtures
    const { data: fixtures } = await supabaseClient.from('fixtures').select('*').eq('status', 'completed');
    // 2. Fetch all teams
    const { data: teams } = await supabaseClient.from('points_table').select('*');

    if (!fixtures || !teams) return;

    // Reset all team stats locally
    const stats = {};
    teams.forEach(t => {
        stats[t.team_name] = {
            played: 0, won: 0, lost: 0, points: 0,
            runs_scored: 0, overs_faced: 0, runs_conceded: 0, overs_bowled: 0
        };
    });

    // Loop through fixtures and sum stats
    fixtures.forEach(f => {
        const t1 = f.team1;
        const t2 = f.team2;
        if (!stats[t1] || !stats[t2]) return;

        stats[t1].played += 1;
        stats[t2].played += 1;
        stats[t1].runs_scored += (f.t1_score || 0);
        stats[t1].runs_conceded += (f.t2_score || 0);
        stats[t2].runs_scored += (f.t2_score || 0);
        stats[t2].runs_conceded += (f.t1_score || 0);

        // Accurate NRR Calculation (Decimal Overs)
        const getOversDecimal = (overs) => {
            const val = parseFloat(overs) || 6.0;
            const fullOvers = Math.floor(val);
            const partialBalls = Math.round((val % 1) * 10);
            return fullOvers + (partialBalls / 6);
        };

        const o1 = getOversDecimal(f.t1_overs);
        const o2 = getOversDecimal(f.t2_overs);

        stats[t1].overs_faced += o1;
        stats[t1].overs_bowled += o2;
        stats[t2].overs_faced += o2;
        stats[t2].overs_bowled += o1;

        if (f.winner === t1) {
            stats[t1].won += 1;
            stats[t1].points += 2;
            stats[t2].lost += 1;
        } else if (f.winner === t2) {
            stats[t2].won += 1;
            stats[t2].points += 2;
            stats[t1].lost += 1;
        } else if (f.winner === 'Draw') {
            stats[t1].points += 1;
            stats[t2].points += 1;
        }
    });

    // Update Supabase for each team
    for (const teamName of Object.keys(stats)) {
        const s = stats[teamName];
        const nrr = s.overs_faced > 0 ? ((s.runs_scored / s.overs_faced) - (s.runs_conceded / s.overs_bowled)) : 0;
        await supabaseClient.from('points_table').update({
            played: s.played,
            won: s.won,
            lost: s.lost,
            points: s.points,
            runs_scored: s.runs_scored,
            runs_conceded: s.runs_conceded,
            nrr: parseFloat(nrr.toFixed(3))
        }).eq('team_name', teamName);
    }
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

    document.getElementById('player-1-box').style.border = liveMatchState.striker === 1 ? '2px solid var(--secondary)' : '1px solid rgba(255,255,255,0.05)';
    document.getElementById('player-2-box').style.border = liveMatchState.striker === 2 ? '2px solid var(--secondary)' : '1px solid rgba(255,255,255,0.05)';

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

        // 3. Update Points Table
        await syncPointsTableFromFixtures();

        // 4. Update Top Performers (Subtract OLD if exists, Add NEW)
        if (m && m.status === 'completed') {
            if (m.top_bat) await updateTournamentCaps(m.top_bat, '', 'batsman', -m.top_bat_runs, 0);
            if (m.top_bowl) await updateTournamentCaps(m.top_bowl, '', 'bowler', 0, -m.top_bowl_wkts);
        }

        if (topBat) await updateTournamentCaps(topBat, '', 'batsman', topBatRuns, 0);
        if (topBowl) await updateTournamentCaps(topBowl, '', 'bowler', 0, topBowlWkts);

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
