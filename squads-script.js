async function initSquads() {
    console.log("🚀 Initializing SATPL Squads Page...");
    await loadRosterFilters();
}

async function loadRosterFilters() {
    const filterContainer = document.getElementById('roster-team-filters');
    if (!filterContainer) return;

    const { data, error } = await window.safeSupabaseCall(() =>
        supabaseClient.from('points_table').select('id, team_name').order('team_name')
    );

    if (error) {
        console.error("Error loading teams:", error);
        filterContainer.innerHTML = '<span style="color: #ff4d8d;">Error loading teams.</span>';
        return;
    }

    if (data) {
        filterContainer.innerHTML = data.map(team => `
            <button class="btn-secondary roster-filter-btn" onclick="loadTeamRoster('${team.id}', this)">
                ${team.team_name}
            </button>
        `).join('');
    }
}

async function loadTeamRoster(teamId, btn) {
    const list = document.getElementById('home-roster-list');
    const profileHeader = document.getElementById('team-profile-header');

    // UI Feedback
    document.querySelectorAll('.roster-filter-btn').forEach(b => b.classList.remove('active-filter'));
    if (btn) btn.classList.add('active-filter');

    // Ensure header is visible but in loading state
    profileHeader.style.display = 'block';
    document.getElementById('team-profile-name').innerText = 'Loading...';

    // 1. Fetch Team Details First (for Logo, Owner, and Base Budget)
    const { data: teamInfo, error: teamError } = await window.safeSupabaseCall(() =>
        supabaseClient
            .from('points_table')
            .select('*')
            .eq('id', teamId)
            .single()
    );

    if (teamError) {
        console.error('Team Info Error:', teamError);
    } else if (teamInfo) {
        // Update Profile UI
        document.getElementById('team-profile-logo').src = teamInfo.logo_url || 'img.svg';
        document.getElementById('team-profile-name').innerText = teamInfo.team_name;
        document.getElementById('team-profile-owner').innerHTML = `Owner: <span style="color: white; font-weight: 600;">${teamInfo.owner_name || 'Not Assigned'}</span>`;

        // Initial Budget placeholders (will refine after roster load)
        const totalBudget = teamInfo.budget || 4000;
        document.getElementById('budget-remaining').innerText = `₹${totalBudget}`;
    }

    // Skeleton Loader UI
    list.innerHTML = `
        <div style="margin-top: 20px;">
            ${Array(5).fill(0).map(() => `
                <div style="display: flex; gap: 15px; margin-bottom: 15px; align-items: center; padding: 15px; background: rgba(255,255,255,0.03); border-radius: 12px;">
                    <div class="skeleton" style="width: 40px; height: 40px; border-radius: 50%;"></div>
                    <div style="flex: 1;">
                        <div class="skeleton" style="width: 60%; height: 15px; margin-bottom: 10px;"></div>
                        <div class="skeleton" style="width: 40%; height: 10px;"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    const { data, error } = await window.safeSupabaseCall(() =>
        supabaseClient
            .from('team_players')
            .select('*')
            .eq('team_id', teamId)
            .order('id')
    );

    if (error) {
        console.error('Squad Load Error:', error);
        list.innerHTML = `<div style="text-align: center; color: #ff4d8d; padding: 50px;">Error: ${error.message}</div>`;
        return;
    }

    if (!data || data.length === 0) {
        list.innerHTML = '<div style="text-align: center; color: var(--text-dim); padding: 50px;" class="animate-slide-up">No squad information available for this team yet.</div>';

        // Reset budget bar to empty
        document.getElementById('budget-spent').innerText = `₹0`;
        document.getElementById('budget-percentage').innerText = `0%`;
        document.getElementById('budget-progress-bar').style.width = `0%`;
        return;
    }

    // 2. Budget Calculation Logic
    const totalSpent = data.reduce((sum, p) => sum + (parseInt(p.bid_amount) || 0), 0);
    const maxBudget = (teamInfo && teamInfo.budget) ? teamInfo.budget : 4000;
    const remaining = maxBudget - totalSpent;
    const spentPercentage = Math.min(100, Math.round((totalSpent / maxBudget) * 100));

    // Update Budget UI with Animation
    document.getElementById('budget-spent').innerText = `₹${totalSpent}`;
    document.getElementById('budget-remaining').innerText = `₹${remaining}`;
    document.getElementById('budget-percentage').innerText = `${spentPercentage}%`;

    const progressBar = document.getElementById('budget-progress-bar');
    progressBar.style.width = `${spentPercentage}%`;

    // Change bar color based on spending
    if (spentPercentage > 90) progressBar.style.background = 'linear-gradient(90deg, #ff4d4d, #ff0000)';
    else if (spentPercentage > 75) progressBar.style.background = 'linear-gradient(90deg, #ffa500, #ff8c00)';
    else progressBar.style.background = 'linear-gradient(90deg, var(--secondary), var(--primary))';

    let tableHtml = `
        <div class="table-responsive animate-slide-up" style="margin-top: 20px;">
            <table class="premium-table">
                <thead>
                    <tr>
                        <th style="width: 80px;">Pos</th>
                        <th style="text-align: left;">Player Name</th>
                        <th style="width: 150px;">Format</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map((p, index) => {
        let formatIcon = '⚔️'; // Default Allrounder
        if (p.playing_format === 'Batting') formatIcon = '🏏';
        if (p.playing_format === 'Bowling') formatIcon = '🎾';

        return `
                        <tr>
                            <td>${index + 1}</td>
                            <td style="text-align: left; font-weight: 600;">
                                <div style="display: flex; flex-direction: column; gap: 4px; cursor: pointer;" 
                                     onclick="openPlayerStarCard('${p.reg_no}', '${p.player_name.replace(/'/g, "\\'")}', '${p.playing_format}', '${p.batting_style || ''}', '${p.bowling_style || ''}', ${p.is_wicket_keeper})">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span style="font-size: 1.1rem;">${formatIcon}</span>
                                        <span class="player-link-hover">${p.player_name}</span>
                                        ${p.is_wicket_keeper ? '<span title="Wicket Keeper" style="background: var(--primary); color: white; font-size: 0.6rem; padding: 2px 5px; border-radius: 4px;">WK 🧤</span>' : ''}
                                    </div>
                                    <div style="font-size: 0.75rem; color: var(--text-dim); display: flex; gap: 10px; margin-left: 28px;">
                                        ${p.batting_style ? `<span>🏏 ${p.batting_style}</span>` : ''}
                                        ${p.bowling_style ? `<span>🎾 ${p.bowling_style}</span>` : ''}
                                    </div>
                                </div>
                            </td>
                            <td>
                                <span class="player-format-badge ${p.playing_format.toLowerCase()}">${p.playing_format}</span>
                            </td>
                        </tr>
                        `;
    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    list.innerHTML = tableHtml;
}

// Configure PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
}

// Helper for PDF to Image
async function renderPdfPhoto(url, imgElement) {
    try {
        if (typeof pdfjsLib === 'undefined') return;
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        imgElement.src = canvas.toDataURL('image/jpeg', 0.9);
    } catch (err) {
        console.error("PDF Render Error:", err);
    }
}

// --- Player Star Card Logic ---
window.openPlayerStarCard = async function (regNo, name, format, batting, bowling, isWK) {
    const modal = document.getElementById('player-modal');
    const body = document.getElementById('player-card-body');

    // Show empty loader card first
    body.innerHTML = '<div style="padding: 100px; text-align: center;"><div class="loading-spinner"></div> Loading Player Profile...</div>';
    modal.style.display = 'flex';

    // Fetch Full Profile for Photo
    console.log(`🔍 Loading Star Card for: ${name} (Reg: ${regNo})`);
    let photoUrl = 'https://via.placeholder.com/400x400?text=SATPL+Player';
    let teamName = "SATPL 2026";

    if (regNo) {
        try {
            const { data, error } = await window.safeSupabaseCall(() =>
                supabaseClient
                    .from('player_registrations')
                    .select('photo_url')
                    .eq('registration_no', regNo.trim())
                    .maybeSingle()
            );

            if (data && data.photo_url) {
                photoUrl = data.photo_url;
            }
        } catch (e) {
            console.error("❌ Profile Fetch Error:", e);
        }
    }

    // Try to get team name from profile header or active filter
    const profileNameEl = document.getElementById('team-profile-name');
    if (profileNameEl && profileNameEl.innerText !== 'Team Name') {
        teamName = profileNameEl.innerText.trim();
    } else {
        const activeBtn = document.querySelector('.roster-filter-btn.active-filter');
        if (activeBtn) teamName = activeBtn.innerText.trim();
    }

    body.innerHTML = `
        <div class="player-card-hero" style="background: #1a1a1a;">
            <img id="modal-player-photo" src="${photoUrl}" alt="${name}" onerror="this.src='https://via.placeholder.com/400x400?text=No+Photo+Found'">
            <div class="verified-badge">✓ VERIFIED PLAYER</div>
        </div>
        <div class="player-card-info">
            <div class="player-name-main gradient-text">${name}</div>
            <div class="player-reg-id">REG ID: ${regNo || 'PENDING'}</div>
            <hr style="opacity: 0.1; margin: 20px 0;">
            <div class="player-stats-grid">
                <div class="stat-item">
                    <div class="stat-label">Role</div>
                    <div class="stat-value" style="color: var(--secondary);">${format} ${isWK ? '(WK)' : ''}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Batting</div>
                    <div class="stat-value">${batting || 'Not Specified'}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Bowling</div>
                    <div class="stat-value">${bowling || 'Not Specified'}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Team</div>
                    <div class="stat-value" style="color: var(--secondary);">${teamName}</div>
                </div>
            </div>
            <div style="margin-top: 30px;">
                <button class="btn" style="width: 100%;" onclick="closePlayerModal()">Close Profile</button>
            </div>
        </div>
    `;

    // Handle PDF rendering if needed
    if (photoUrl.toLowerCase().endsWith('.pdf')) {
        const imgEl = document.getElementById('modal-player-photo');
        renderPdfPhoto(photoUrl, imgEl);
    }
};

window.closePlayerModal = function () {
    document.getElementById('player-modal').style.display = 'none';
};

// Close modal on background click
window.addEventListener('click', (e) => {
    const modal = document.getElementById('player-modal');
    if (e.target === modal) closePlayerModal();
});

document.addEventListener('DOMContentLoaded', initSquads);
