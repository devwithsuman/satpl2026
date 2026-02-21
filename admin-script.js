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
    if (target) target.classList.add("active");
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

        // Reset Scoring fields too
        if (document.getElementById("hero-wickets")) {
            document.getElementById("hero-wickets").value = 0;
            document.getElementById("hero-overs").value = 0;
            document.getElementById("hero-balls").value = 0;
            document.getElementById("hero-target").value = 0;
            document.getElementById("hero-batsman1").value = "";
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
        batsman1: document.getElementById("hero-batsman1").value
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

    if (data) {
        list.innerHTML = data.map(item => createMenuRowHtml(item)).join("");
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
            const serial = playerRow.reg_serial || playerRow.id;
            const serialNum = parseInt(serial);
            const registrationNo = `OSATPL01S${(serialNum + 2000).toString().padStart(4, "0")}`;

            console.log("Confirmed Reg No:", registrationNo, "from Serial:", serial);

            const { error: regError } = await supabaseClient
                .from("player_registrations")
                .update({ registration_no: registrationNo })
                .eq("id", id);

            if (regError) console.warn("Error generating reg_no:", regError.message);
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

    console.log("Points Table Data Loaded:", data);

    list.innerHTML = data.map(team => `
        <tr data-id="${team.id}">
            <td><input type="text" value="${team.team_name}" class="table-input team-name-input"></td>
            <td><input type="number" value="${team.played}" class="table-input played-input"></td>
            <td><input type="number" value="${team.won}" class="table-input won-input"></td>
            <td><input type="number" value="${team.lost}" class="table-input lost-input"></td>
            <td><input type="number" value="${team.points}" class="table-input points-input" style="font-weight: bold; color: var(--secondary);"></td>
        </tr>
    `).join("");
}

async function savePointsTable() {
    const rows = document.querySelectorAll("#admin-points-list tr");
    const updates = Array.from(rows).map(row => ({
        id: parseInt(row.dataset.id),
        team_name: row.querySelector(".team-name-input").value,
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
        const p = (data && data[i]) || { player_name: "", playing_format: "Allrounder", is_wicket_keeper: false };
        rowsHtml += `
            <tr data-index="${i}" data-id="${p.id || ''}">
                <td style="color: var(--text-dim);">${i + 1}</td>
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

async function saveRoster() {
    const teamId = document.getElementById("roster-team-select").value;
    const teamName = document.getElementById("roster-team-select").options[document.getElementById("roster-team-select").selectedIndex].text;
    if (!teamId) return alert("Select a team first");

    const rows = document.querySelectorAll("#admin-roster-list tr");
    const players = [];

    rows.forEach(row => {
        const name = row.querySelector(".player-name").value.trim();
        if (name) {
            const player = {
                team_id: parseInt(teamId),
                team_name: teamName, // Keep for display/backup
                player_name: name,
                playing_format: row.querySelector(".player-format").value,
                is_wicket_keeper: row.querySelector(".player-wk").checked
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

        if (data.qr_code_url) {
            document.getElementById("qr-preview").innerHTML = `<img src="${data.qr_code_url}" style="width: 150px; height: 150px; border-radius: 10px; border: 1px solid var(--glass-border);">`;
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
        facebook_url: document.getElementById("set-facebook").value
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

// ================= INIT =================
async function init() {
    // Safety Check: Ensure supabaseClient is defined
    if (typeof window.supabaseClient === 'undefined') {
        console.error("🚨 Supabase Client is not defined! Ensure supabase-config.js is correctly included in HTML.");
        alert("Critical Error: Database connection (supabaseClient) not found. Please refresh the page.");
        return;
    }

    // Alias global to local if needed
    if (typeof supabaseClient === 'undefined') {
        window.supabaseClient = window.supabaseClient;
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
            { name: "Navigation Menu", fn: fetchAdminMenu }
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
