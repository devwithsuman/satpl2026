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
        if (sectionId === 'announcements') fetchNotices();
        if (sectionId === 'fixtures') fetchFixtures();
        if (sectionId === 'leaderboard') fetchLeaderboard();
        if (sectionId === 'gallery') fetchGallery();
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
    if (document.getElementById("hero-map-url")) document.getElementById("hero-map-url").value = data.map_url || "";

    // Detailed Scoring Fields
    if (document.getElementById("hero-wickets")) {
        document.getElementById("hero-wickets").value = data.wickets || 0;
        document.getElementById("hero-overs").value = data.overs || 0;
        document.getElementById("hero-balls").value = data.balls || 0;
        document.getElementById("hero-target").value = data.target || 0;
        document.getElementById("hero-batsman1").value = data.batsman1 || "";
        document.getElementById("hero-batsman1-runs").value = data.batsman1_runs || 0;
        document.getElementById("hero-batsman1-balls").value = data.batsman1_balls || 0;
    }

    // Toggle scoring panel based on match type
    const scoringPanel = document.getElementById("pro-scoring-panel");
    if (scoringPanel) {
        scoringPanel.style.display = matchKey === 'live-match' ? 'block' : 'none';
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
        map_url: document.getElementById("hero-map-url").value
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

    b++;
    if (b >= 6) {
        b = 0;
        o++;
    }
    ballsVal.value = b;
    oversVal.value = o;
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
            <td><input type="text" value="${team.team_name || ''}" class="table-input team-name-input"></td>
            <td><input type="text" value="${team.logo_url || ''}" class="table-input logo-input" placeholder="URL"></td>
            <td><input type="text" value="${team.owner_name || ''}" class="table-input owner-input"></td>
            <td><input type="number" value="${team.played}" class="table-input played-input" oninput="calculatePoints(this)"></td>
            <td><input type="number" value="${team.won}" class="table-input won-input" oninput="calculatePoints(this)"></td>
            <td><input type="number" value="${team.lost}" class="table-input lost-input" oninput="calculatePoints(this)"></td>
            <td><input type="number" value="${team.points}" class="table-input points-input" readonly style="font-weight: bold; color: var(--secondary); background: rgba(0,0,0,0.2); cursor: not-allowed;"></td>
        </tr>
    `).join("");
}

// Global function to auto-calculate points
function calculatePoints(input) {
    const row = input.closest('tr');
    const won = parseInt(row.querySelector('.won-input').value) || 0;

    // Logic: Win = 2 Points
    const totalPoints = won * 2;

    row.querySelector('.points-input').value = totalPoints;
    console.log(`📊 Auto-calculated Points: ${totalPoints}`);
}

async function savePointsTable() {
    const rows = document.querySelectorAll("#admin-points-list tr");
    const updates = Array.from(rows).map(row => ({
        id: parseInt(row.dataset.id),
        team_name: row.querySelector(".team-name-input").value,
        logo_url: row.querySelector(".logo-input").value,
        owner_name: row.querySelector(".owner-input").value,
        played: parseInt(row.querySelector(".played-input").value) || 0,
        won: parseInt(row.querySelector(".won-input").value) || 0,
        lost: parseInt(row.querySelector(".lost-input").value) || 0,
        points: parseInt(row.querySelector(".points-input").value) || 0
    }));

    const { error } = await supabaseClient.from("points_table").upsert(updates);

    if (error) {
        alert("Error saving: " + error.message);
    } else {
        console.log("Points table updated successfully.");
        alert("Points Table Updated Successfully!");
        fetchAdminPoints();
        loadRosterTeams(); // Refresh roster dropdown with new names
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
        facebook_url: document.getElementById("set-facebook").value,
        map_url: document.getElementById("set-map-url").value,
        reg_end_date: document.getElementById("set-reg-end").value
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
                <td><button class="btn-secondary" style="background: #ef4444; border: none; padding: 5px 10px;" onclick="deleteFixture('${f.id}')">Del</button></td>
            </tr>
        `;
    }).join('');
}

function openFixtureModal() { document.getElementById('fixture-modal').style.display = 'flex'; }
function closeFixtureModal() { document.getElementById('fixture-modal').style.display = 'none'; }

async function saveFixture(event) {
    event.preventDefault();
    const updates = {
        match_no: Number(document.getElementById('fix-no').value),
        match_date: document.getElementById('fix-date').value,
        match_time: document.getElementById('fix-time').value,
        team1: document.getElementById('fix-t1').value,
        team2: document.getElementById('fix-t2').value,
        venue: document.getElementById('fix-venue').value,
        status: document.getElementById('fix-status').value
    };
    const { error } = await supabaseClient.from('fixtures').insert([updates]);
    if (error) alert(error.message);
    else { closeFixtureModal(); fetchFixtures(); }
}

async function toggleFixtureStatus(id, current) {
    const next = current === 'upcoming' ? 'completed' : 'upcoming';
    await supabaseClient.from('fixtures').update({ status: next }).eq('id', id);
    fetchFixtures();
}

async function deleteFixture(id) {
    if (!confirm("Are you sure?")) return;
    await supabaseClient.from('fixtures').delete().eq('id', id);
    fetchFixtures();
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
            <td><button class="btn-secondary" style="background: #ef4444; border: none; padding: 5px 10px;" onclick="deleteLeaderboard('${p.id}')">Del</button></td>
        </tr>
    `).join('');
}

function openLeaderboardModal() { document.getElementById('leaderboard-modal').style.display = 'flex'; }
function closeLeaderboardModal() { document.getElementById('leaderboard-modal').style.display = 'none'; }

async function saveLeaderboard(event) {
    event.preventDefault();
    const cat = document.getElementById('stat-category').value;
    const updates = {
        player_name: document.getElementById('stat-name').value,
        team_name: document.getElementById('stat-team').value,
        category: cat,
        runs: cat === 'batsman' ? Number(document.getElementById('stat-value').value) : 0,
        wickets: cat === 'bowler' ? Number(document.getElementById('stat-value').value) : 0
    };
    await supabaseClient.from('top_performers').insert([updates]);
    closeLeaderboardModal(); fetchLeaderboard();
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
    document.querySelector(`input[name="gallery-orientation"][value="${photo.orientation || 'landscape'}"]`).checked = true;

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
                const fileName = `gallery_${timestamp}.${ext}`;

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
                const fileName = `gallery_${timestamp}.${ext}`;

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
