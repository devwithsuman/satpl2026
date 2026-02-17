async function initSquads() {
    console.log("🚀 Initializing SATPL Squads Page...");
    await loadRosterFilters();
}

async function loadRosterFilters() {
    const filterContainer = document.getElementById('roster-team-filters');
    if (!filterContainer) return;

    const { data, error } = await supabaseClient.from('points_table').select('id, team_name').order('team_name');

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

    // UI Feedback
    document.querySelectorAll('.roster-filter-btn').forEach(b => b.classList.remove('active-filter'));
    if (btn) btn.classList.add('active-filter');

    list.innerHTML = '<div style="text-align: center; padding: 50px;"><div class="loading-spinner"></div> Loading Squad List...</div>';

    const { data, error } = await supabaseClient
        .from('team_players')
        .select('*')
        .eq('team_id', teamId)
        .order('id');

    if (error) {
        console.error('Squad Load Error:', error);
        list.innerHTML = `<div style="text-align: center; color: #ff4d8d; padding: 50px;">Error: ${error.message}</div>`;
        return;
    }

    if (!data || data.length === 0) {
        list.innerHTML = '<div style="text-align: center; color: var(--text-dim); padding: 50px;">No squad information available for this team yet.</div>';
        return;
    }

    let tableHtml = `
        <div class="table-responsive" style="margin-top: 20px;">
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
                                <span style="margin-right: 8px;">${formatIcon}</span>
                                ${p.player_name} 
                                ${p.is_wicket_keeper ? '<span title="Wicket Keeper" style="margin-left: 10px;">🧤</span>' : ''}
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

document.addEventListener('DOMContentLoaded', initSquads);
