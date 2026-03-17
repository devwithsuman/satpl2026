/**
 * SATPL 2026 - Match Fixtures Logic
 * Populates upcoming match schedule on the home page.
 */

async function initFixtures() {
    const list = document.getElementById('fixtures-list');
    if (!list) return;

    // Initial fetch
    await fetchMatches();

    // Set up real-time subscription
    if (window.supabaseClient) {
        window.supabaseClient
            .channel('fixtures_realtime')
            .on('postgres_changes', { event: '*', table: 'fixtures', schema: 'public' }, () => {
                console.log('🔄 Fixtures updated in real-time');
                fetchMatches();
            })
            .subscribe();
    }
}

let teamDataCache = {};

async function fetchMatches() {
    if (!window.supabaseClient) {
        console.warn('Supabase client not initialized for fixtures');
        return;
    }

    try {
        // Fetch matches and team logos/details in parallel
        const [matchRes, teamRes] = await Promise.all([
            window.supabaseClient
                .from('fixtures')
                .select('*')
                .eq('status', 'upcoming')
                .order('match_date', { ascending: true })
                .order('match_time', { ascending: true })
                .limit(6),
            window.supabaseClient
                .from('points_table')
                .select('team_name, logo_url, owners, owner_name, owner_photo, captain_name, captain_photo')
        ]);

        if (matchRes.error) throw matchRes.error;

        // Cache team data for quick lookup
        if (teamRes.data) {
            teamRes.data.forEach(t => {
                teamDataCache[t.team_name] = t;
            });
        }

        renderMatches(matchRes.data);
    } catch (err) {
        console.error('Error fetching fixtures:', err);
    }
}

function formatTimeTo12h(timeStr) {
    if (!timeStr) return "";
    try {
        const [hours, minutes] = timeStr.split(':');
        let h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        h = h ? h : 12; // the hour '0' should be '12'
        return `${h.toString().padStart(2, '0')}:${minutes} ${ampm}`;
    } catch (e) {
        return timeStr;
    }
}

function renderMatches(matches) {
    const list = document.getElementById('fixtures-list');
    if (!list) return;

    if (!matches || matches.length === 0) {
        list.innerHTML = `<div class="glass" style="padding: 40px; text-align: center; color: var(--text-dim); width: 100%;">No upcoming matches scheduled. Check back later! 🏏</div>`;
        return;
    }

    list.innerHTML = matches.map(match => {
        const dateObj = new Date(match.match_date);
        const day = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
        const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        const team1 = teamDataCache[match.team1] || { logo_url: 'logo.png' };
        const team2 = teamDataCache[match.team2] || { logo_url: 'logo.png' };

        return `
        <div class="glass fixture-card animate-fade">
            <div class="match-header">
                <div class="fixture-team" style="min-width: 0; cursor: pointer;" onclick="showTeamProfile('${match.team1}')">
                    <div class="team-logo-small">
                        <img src="${team1.logo_url || 'logo.png'}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">
                    </div>
                    <span style="font-weight: 700; font-size: 0.85rem; text-align: center; color: white; line-height: 1.2; width: 100%; word-break: break-word;">${match.team1}</span>
                </div>
                
                <div class="vs-badge">VS</div>
                
                <div class="fixture-team" style="min-width: 0; cursor: pointer;" onclick="showTeamProfile('${match.team2}')">
                    <div class="team-logo-small">
                        <img src="${team2.logo_url || 'logo.png'}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">
                    </div>
                    <span style="font-weight: 700; font-size: 0.85rem; text-align: center; color: white; line-height: 1.2; width: 100%; word-break: break-word;">${match.team2}</span>
                </div>
            </div>
            
            <div class="match-footer">
                <div class="match-day">${day}, ${formattedDate}</div>
                <div class="match-time">${formatTimeTo12h(match.match_time)}</div>
                <div class="match-venue">
                    <span>📍</span> ${match.venue}
                </div>
            </div>
        </div>
    `}).join('');
}

/**
 * Show Team Profile (Owner/Captain) in a modal
 */
function showTeamProfile(teamName) {
    const team = teamDataCache[teamName];
    if (!team) return;

    // Create modal if it doesn't exist
    let modal = document.getElementById('team-profile-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'team-profile-modal';
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content premium-popup animate-slide-up" style="max-width: 600px; padding: 0; overflow: hidden; border: none;">
                <button class="close-popup-btn" onclick="document.getElementById('team-profile-modal').style.display='none'">×</button>
                <div id="profile-modal-body"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const body = document.getElementById('profile-modal-body');
    const owners = Array.isArray(team.owners) ? team.owners : (team.owner_name ? [{ name: team.owner_name, photo: team.owner_photo }] : []);

    body.innerHTML = `
        <div style="background: linear-gradient(135deg, var(--primary), var(--secondary)); padding: 40px 20px; text-align: center; position: relative;">
            <img src="${team.logo_url || 'logo.png'}" style="width: 100px; height: 100px; border-radius: 50%; background: white; padding: 5px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); margin-bottom: 15px;">
            <h2 style="color: white; margin: 0; font-size: 2rem;">${team.team_name}</h2>
            <div style="font-weight: 800; color: rgba(255,255,255,0.8); letter-spacing: 2px; margin-top: 5px;">OFFICIAL PROFILE</div>
        </div>
        
        <div style="padding: 30px; display: flex; flex-direction: column; gap: 25px;">
            <!-- Owners Section -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 15px;">
                ${owners.length > 0 ? owners.map(o => `
                    <div class="glass" style="padding: 15px; text-align: center; border-color: var(--primary-glow);">
                        <div style="width: 60px; height: 60px; margin: 0 auto 10px; border-radius: 50%; overflow: hidden; border: 2px solid var(--primary);">
                            <img src="${o.photo || 'img.svg'}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                        <div style="font-size: 0.6rem; color: var(--text-dim); letter-spacing: 1px;">OWNER</div>
                        <div style="font-weight: 700; font-size: 0.9rem; color: white; margin-top: 2px;">${o.name}</div>
                    </div>
                `).join('') : `
                    <div class="glass" style="padding: 15px; text-align: center; grid-column: 1 / -1;">
                        <div style="color: var(--text-dim);">No owners assigned</div>
                    </div>
                `}
            </div>
            
            <!-- Captain Section -->
            <div class="glass" style="padding: 20px; text-align: center; border-color: var(--secondary-glow); display: flex; align-items: center; gap: 20px; justify-content: center;">
                <div style="width: 70px; height: 70px; border-radius: 50%; overflow: hidden; border: 3px solid var(--secondary); flex-shrink: 0;">
                    <img src="${team.captain_photo || 'img.svg'}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <div style="text-align: left;">
                    <div style="font-size: 0.7rem; color: var(--text-dim); letter-spacing: 1px;">TEAM CAPTAIN</div>
                    <div style="font-weight: 800; font-size: 1.2rem; color: white; margin-top: 5px;">${team.captain_name || 'Not Set'}</div>
                </div>
            </div>
        </div>
        
        <div style="padding: 0 30px 30px;">
            <button class="btn" style="width: 100%;" onclick="document.getElementById('team-profile-modal').style.display='none'">Back to Schedule</button>
        </div>
    `;

    modal.style.display = 'flex';
}

// Initialize on load
window.addEventListener('DOMContentLoaded', initFixtures);
