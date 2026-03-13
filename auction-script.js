// SATPL Live Auction Script
// Handles Real-time updates and UI synchronization

let currentAuctionStatus = 'idle';
let currentTimerSeconds = 30;
let timerInterval = null;
let highestBidderId = null;
let currentBid = 0;

async function initAuction() {
    console.log("🎮 Initializing Auction Realtime...");

    // Fetch initial settings to populate global variables
    const { data: initialSettings, error: settingsError } = await supabaseClient
        .from('auction_settings')
        .select('*')
        .eq('id', 'global')
        .single();

    if (initialSettings) {
        highestBidderId = initialSettings.highest_bidder_id;
        currentBid = initialSettings.current_bid || 0;
    } else if (settingsError) {
        console.error("Error fetching initial auction settings:", settingsError);
    }

    // 1. Initial Load
    await fetchAuctionState();
    await fetchRecentBids();
    await fetchRecentlySold();
    await fetchTeamBudgets();

    // 2. Subscribe to Realtime Changes
    // Subscribe to settings changes (current player, status, bid)
    supabaseClient
        .channel('auction_settings_changes')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'auction_settings',
            filter: 'id=eq.global'
        }, payload => {
            console.log("🔄 Auction Settings Updated:", payload.new);
            updateUI(payload.new);
        })
        .subscribe();

    // Subscribe to new bids
    supabaseClient
        .channel('auction_bids_changes')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'auction_bids'
        }, payload => {
            console.log("🚀 New Bid Received:", payload.new);
            handleNewBid(payload.new);
        })
        .subscribe();

    // Subscribe to new sold/released players (team_players)
    supabaseClient
        .channel('auction_players_changes')
        .on('postgres_changes', {
            event: '*', // Listen to INSERT (sold) and DELETE (released)
            schema: 'public',
            table: 'team_players'
        }, payload => {
            console.log("✅ Squad Change Detected:", payload.eventType);
            fetchRecentlySold();
            fetchTeamBudgets();
        })
        .subscribe();

    // Subscribe to points_table changes (for manual budget edits or sync tool)
    supabaseClient
        .channel('auction_budget_sync')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'points_table'
        }, payload => {
            console.log("💰 Budget Change Detected:", payload.new);
            fetchTeamBudgets();
        })
        .subscribe();
}

async function fetchAuctionState() {
    const { data, error } = await supabaseClient
        .from('auction_settings')
        .select('*')
        .eq('id', 'global')
        .single();

    if (error) {
        console.error("Error fetching auction state:", error);
        return;
    }

    if (data) {
        updateUI(data);
    }
}

async function fetchRecentBids() {
    const { data: settings } = await supabaseClient.from('auction_settings').select('current_player_id').eq('id', 'global').single();

    if (settings && settings.current_player_id) {
        const { data: bids } = await supabaseClient
            .from('auction_bids')
            .select('*, points_table(team_name)')
            .eq('player_id', settings.current_player_id)
            .order('created_at', { ascending: false })
            .limit(5);

        if (bids) {
            renderBidHistory(bids);
        }
    }
}

async function updateUI(settings) {
    const activeView = document.getElementById('auction-active-view');
    const idleView = document.getElementById('auction-idle-view');
    const statusText = document.getElementById('auction-status-text');

    currentAuctionStatus = settings.status;

    if (settings.status === 'idle') {
        activeView.style.display = 'none';
        idleView.style.display = 'block';
        stopTimer();
        return;
    }

    activeView.style.display = 'grid';
    idleView.style.display = 'none';

    highestBidderId = settings.highest_bidder_id;
    currentBid = settings.current_bid || 0;

    // Update Status Label
    statusText.innerText = settings.status === 'bidding' ? 'LIVE BIDDING' : (settings.status === 'sold' ? 'SOLD' : 'UNSOLD');

    // Update Bid Info
    document.getElementById('current-bid').innerText = settings.current_bid.toLocaleString();

    // Fetch Bidder Name if present
    if (settings.highest_bidder_id) {
        const { data: team } = await supabaseClient.from('points_table').select('team_name').eq('id', settings.highest_bidder_id).single();
        document.getElementById('highest-bidder').innerText = team ? team.team_name : 'Team Found';
    } else {
        document.getElementById('highest-bidder').innerText = 'NO BIDS YET';
    }

    // Timer Sync
    if (settings.status === 'bidding') {
        syncTimer(settings.timer_seconds);
    } else {
        stopTimer();
    }

    // Player Data Sync
    if (settings.current_player_id) {
        await fetchAndRenderPlayer(settings.current_player_id);
    }

    // Sound on Status Change
    if (settings.status === 'sold' && currentAuctionStatus !== 'sold') {
        AuctionAudio.play('sold');
    } else if (settings.status === 'unsold' && currentAuctionStatus !== 'unsold') {
        AuctionAudio.play('unsold');
    }

    currentAuctionStatus = settings.status;

    // Always refresh sold list and budgets on status/bid change
    fetchRecentlySold();
    fetchTeamBudgets();
}

async function fetchAndRenderPlayer(playerId) {
    const { data: player, error } = await supabaseClient
        .from('player_registrations')
        .select('*')
        .eq('id', playerId)
        .single();

    if (player) {
        document.getElementById('player-name').innerText = player.player_name;
        document.getElementById('player-reg-no').innerText = player.registration_no || 'TBD';
        document.getElementById('player-batting').innerText = (player.batting || 'Right').toUpperCase() + ' HAND';
        document.getElementById('player-bowling').innerText = (player.bowling || 'Right').toUpperCase() + ' ARM';
        document.getElementById('player-wk').innerText = (player.wicket_keeper || 'no').toUpperCase();
        if (player.photo_url) {
            document.getElementById('player-photo').src = player.photo_url;
        }
    }
}

function handleNewBid(bid) {
    AuctionAudio.play('bid');
    fetchAuctionState(); // Refresh state to get latest bid/bidder
    fetchRecentBids(); // Refresh history
}

function renderBidHistory(bids) {
    const list = document.getElementById('bid-history');
    if (!list) return;

    if (!bids || bids.length === 0) {
        list.innerHTML = '<li class="history-item" style="color: var(--text-dim); text-align: center; justify-content: center;">Waiting for bids...</li>';
        return;
    }

    list.innerHTML = bids.map(bid => `
        <li class="history-item">
            <span class="history-team">${bid.points_table?.team_name || 'Team'}</span>
            <span class="history-amount">₹${bid.bid_amount.toLocaleString()}</span>
        </li>
    `).join('');
}

async function fetchRecentlySold() {
    // 1. First get the current auction session start time
    const { data: settings } = await supabaseClient
        .from('auction_settings')
        .select('updated_at')
        .eq('id', 'global')
        .single();

    if (!settings) return;

    // We consider anything sold within the last 12 hours as "this session"
    // to prevent historic test data from piling up.
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

    const { data: sold, error } = await supabaseClient
        .from('team_players')
        .select('*')
        .gte('created_at', twelveHoursAgo)
        .order('created_at', { ascending: false })
        .limit(5);

    if (sold) {
        renderRecentlySold(sold);
    }
}

function renderRecentlySold(players) {
    const list = document.getElementById('recently-sold-list');
    if (!list) return;

    if (!players || players.length === 0) {
        list.innerHTML = '<div style="text-align: center; color: var(--text-dim); font-size: 0.8rem; padding: 10px;">No players sold yet.</div>';
        return;
    }

    list.innerHTML = players.map(p => `
        <div style="background: rgba(34, 197, 94, 0.05); border: 1px solid rgba(34, 197, 94, 0.1); padding: 10px 15px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
            <div style="text-align: left;">
                <div style="color: #fff; font-weight: 700; font-size: 0.9rem;">${p.player_name}</div>
                <div style="color: #22c55e; font-size: 0.7rem; font-weight: 600;">${p.team_name}</div>
            </div>
            <div style="text-align: right;">
                 <span style="color: #64748b; font-size: 0.6rem; display: block;">FINAL PRICE</span>
                 <span style="color: #fff; font-weight: 800; font-size: 0.8rem; font-family: monospace;">₹${(p.bid_amount || 0).toLocaleString()}</span>
            </div>
        </div>
    `).join('');
}

// Budget Logic
async function fetchTeamBudgets() {
    console.log("💰 Refreshing Team Budgets (Dynamic calculation)...");
    try {
        // 1. Fetch Teams
        const { data: teams, error: teamsErr } = await window.supabaseClient
            .from('points_table')
            .select('id, team_name, budget')
            .order('team_name', { ascending: true });

        // 2. Fetch All Squad Players to calculate spent amount live
        const { data: squads, error: squadsErr } = await window.supabaseClient
            .from('team_players')
            .select('team_id, bid_amount');

        const list = document.getElementById('team-budget-list');
        if (teamsErr || squadsErr) {
            const err = teamsErr || squadsErr;
            if (list) list.innerHTML = `<div style="color:red; font-size: 0.7rem;">ERR: ${err.message}</div>`;
            return;
        }

        if (teams) {
            // Map spent amounts from squads
            const enrichedTeams = teams.map(team => {
                const spent = squads
                    ? squads.filter(p => p.team_id === team.id).reduce((sum, p) => sum + (p.bid_amount || 0), 0)
                    : 0;
                return { ...team, spent_points: spent };
            });
            renderTeamBudgets(enrichedTeams);
        }
    } catch (err) {
        const list = document.getElementById('team-budget-list');
        if (list) list.innerHTML = `<div style="color:red; font-size: 0.7rem;">CATCH: ${err.message}</div>`;
    }
}

function renderTeamBudgets(teams) {
    const list = document.getElementById('team-budget-list');
    if (!list) return;

    if (!teams || teams.length === 0) {
        list.innerHTML = '<div style="text-align: center; color: var(--text-dim); font-size: 0.8rem; padding: 10px;">No teams found.</div>';
        return;
    }

    list.innerHTML = teams.map(t => {
        let b = typeof t.budget === 'number' ? t.budget : 0;
        let s = typeof t.spent_points === 'number' ? t.spent_points : 0;

        // Apply "Live Commitment" if this team is currently winning but sale isn't final
        if (highestBidderId === t.id && currentAuctionStatus === 'bidding') {
            s += currentBid;
        }

        const remaining = b - s;
        return `
            <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05); padding: 10px 15px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                <div style="text-align: left;">
                    <div style="color: #fff; font-weight: 700; font-size: 0.8rem;">${t.team_name || 'Unknown Team'}</div>
                    <div style="color: var(--secondary); font-size: 0.65rem; font-weight: 600;">₹${s.toLocaleString()} USED</div>
                </div>
                <div style="text-align: right;">
                     <span style="color: var(--text-dim); font-size: 0.55rem; display: block;">REMAINING</span>
                     <span style="color: #22c55e; font-weight: 800; font-size: 0.85rem; font-family: monospace;">₹${remaining.toLocaleString()}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Timer Logic
function syncTimer(seconds) {
    currentTimerSeconds = parseInt(seconds);
    updateTimerUI();

    if (timerInterval) clearInterval(timerInterval);

    if (currentAuctionStatus === 'bidding') {
        timerInterval = setInterval(() => {
            if (currentTimerSeconds > 0) {
                currentTimerSeconds--;
                updateTimerUI();
            } else {
                clearInterval(timerInterval);
            }
        }, 1000);
    }
}

function updateTimerUI() {
    const timerVal = document.getElementById('timer-value');
    const timerCircle = document.getElementById('timer-progress');
    const timerContainer = document.querySelector('.timer-circle');
    const body = document.body;

    if (!timerVal || !timerCircle) return;

    timerVal.innerText = currentTimerSeconds;

    // SVG Progress: dashoffset = total_dash (298.5) * (1 - current/max)
    const maxTime = 30; // Assuming 30s is the default reset
    const offset = 298.5 * (1 - currentTimerSeconds / maxTime);
    timerCircle.style.strokeDashoffset = offset;

    // Color & Sound feedback
    if (currentTimerSeconds <= 5 && currentTimerSeconds > 0) {
        timerVal.style.color = '#ff0000';
        timerCircle.style.stroke = '#ff0000';
        if (timerContainer) timerContainer.classList.add('timer-flash');
        body.classList.add('flash-active');
        // Warning sound
        AuctionAudio.play('warning');
    } else if (currentTimerSeconds <= 10) {
        timerVal.style.color = '#ff8c00';
        timerCircle.style.stroke = '#ff8c00';
        if (timerContainer) timerContainer.classList.remove('timer-flash');
        body.classList.remove('flash-active');
    } else {
        timerVal.style.color = 'var(--primary)';
        timerCircle.style.stroke = 'var(--primary)';
        if (timerContainer) timerContainer.classList.remove('timer-flash');
        body.classList.remove('flash-active');
    }

    if (currentTimerSeconds === 0 && currentAuctionStatus === 'bidding') {
        if (timerContainer) timerContainer.classList.remove('timer-flash');
        body.classList.remove('flash-active');
    }
}

function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    const timerVal = document.getElementById('timer-value');
    const timerCircle = document.getElementById('timer-progress');
    const timerContainer = document.querySelector('.timer-circle');

    if (timerVal) timerVal.innerText = "--";
    if (timerCircle) timerCircle.style.strokeDashoffset = 0;
    if (timerContainer) timerContainer.classList.remove('timer-flash');
    document.body.classList.remove('flash-active');
}

// ================= AUDIO MANAGER (WEB AUDIO API) =================
const AuctionAudio = {
    context: null,

    init() {
        if (!this.context) {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
        }
    },

    play(type) {
        this.init();
        if (this.context.state === 'suspended') {
            this.context.resume();
        }

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.connect(gain);
        gain.connect(this.context.destination);

        const now = this.context.currentTime;

        switch (type) {
            case 'bid':
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            case 'warning':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(220, now);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
                break;
            case 'sold':
                // Success Gavel Sound (Double tap)
                this._gavel(now);
                this._gavel(now + 0.2);
                break;
            case 'unsold':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.linearRampToValueAtTime(110, now + 0.5);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
                osc.start(now);
                osc.stop(now + 0.5);
                break;
        }
    },

    _gavel(time) {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        osc.connect(gain);
        gain.connect(this.context.destination);

        osc.type = 'square';
        osc.frequency.setValueAtTime(150, time);
        gain.gain.setValueAtTime(0.4, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
        osc.start(time);
        osc.stop(time + 0.1);
    }
};

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
    initAuction();
    // Enable audio context on first click (browser requirements)
    document.body.addEventListener('click', () => AuctionAudio.init(), { once: true });
});
