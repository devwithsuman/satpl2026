async function loadHomepageContent() {
    console.log("🚀 Initializing SATPL Homepage...");
    initParticles();
    initScrollReveal(); // Initialize scroll animations

    // 1. Initial Load
    await Promise.all([
        loadHeroAndScores(),
        loadPointsTable(),
        loadSiteSettings(),
        loadNotices(),
        loadLeaderboard(),
        loadGallery(),
        loadSponsors(),
        startCountdown(),
        checkLiveAuction()
    ]).catch(err => console.error("Initial Load Error:", err));

    // 2. Setup Real-time Sync (The "Bulletproof" Flow)
    try {
        setupRealtimeSync();
    } catch (e) {
        console.error("Realtime Setup Error:", e);
    }

    // 🚀 GLOBAL FALLBACK POLLING (Every 10s)
    // Moving this OUTSIDE setupRealtimeSync to ensure it starts even if Realtime errors out
    if (!window.liveSyncPollingStarted) {
        setInterval(() => {
            console.log("💓 Heartbeat: Auto-Refreshing Live Score...");
            loadHeroAndScores();
        }, 10000);
        window.liveSyncPollingStarted = true;
    }
}


// --- SCROLL REVEAL LOGIC ---
function initScrollReveal() {
    const observerOptions = {
        threshold: 0.15
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

async function loadNotices() {
    const list = document.getElementById('notice-list');
    const popup = document.getElementById('notice-popup');

    try {
        // 1. Fetch notices and site settings in parallel
        const [noticesRes, settingsRes] = await Promise.all([
            window.safeSupabaseCall(() =>
                supabaseClient
                    .from('notices')
                    .select('*')
                    .eq('is_active', true)
                    .order('created_at', { ascending: false })
                    .limit(5)
            ),
            window.safeSupabaseCall(() =>
                supabaseClient
                    .from('site_settings')
                    .select('is_popup_enabled, featured_notice_id')
                    .eq('id', 'global-settings')
                    .single()
            )
        ]);

        if (noticesRes.error) throw noticesRes.error;

        const data = noticesRes.data;
        const isPopupEnabled = settingsRes.data ? settingsRes.data.is_popup_enabled : true; // Default to true
        const featuredNoticeId = settingsRes.data ? settingsRes.data.featured_notice_id : null;

        if (!data || data.length === 0) {
            if (list) list.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 20px;">No new announcements at the moment.</div>`;
            if (popup) popup.style.display = 'none';
            return;
        }

        // 2. Select notice for popup: Featured first, then Latest
        let popupNotice = data[0]; // Default to latest
        if (featuredNoticeId) {
            const featured = data.find(n => n.id === featuredNoticeId);
            if (featured) {
                popupNotice = featured;
            } else {
                // If featured notice not in the 5 active ones, fetch it specifically
                const { data: specificNotice } = await window.safeSupabaseCall(() =>
                    supabaseClient
                        .from('notices')
                        .select('*')
                        .eq('id', featuredNoticeId)
                        .single()
                );
                if (specificNotice && specificNotice.is_active) {
                    popupNotice = specificNotice;
                }
            }
        }

        if (popup) {
            if (isPopupEnabled) {
                document.getElementById('popup-title').innerText = popupNotice.title;
                document.getElementById('popup-content').innerText = popupNotice.content || '';
                popup.style.display = 'flex';
            } else {
                popup.style.display = 'none';
            }
        }

        list.innerHTML = data.map(notice => {
            return `
                <div class="ticker-item">
                    <span>📢 <strong>${notice.title}:</strong> ${notice.content || ''}</span>
                </div>
            `;
        }).join('') + data.map(notice => { // Duplicate for seamless loop
            return `
                <div class="ticker-item">
                    <span>📢 <strong>${notice.title}:</strong> ${notice.content || ''}</span>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Error loading notices:", err);
        list.innerHTML = `<div style="text-align: center; color: var(--primary); padding: 20px;">Unable to load news feed.</div>`;
    }
}

function closeNoticePopup() {
    const popup = document.getElementById('notice-popup');
    if (popup) {
        popup.style.display = 'none';
        // Add a nice exit animation class if needed
    }
}

function setupRealtimeSync() {
    console.log("📡 Enabling Real-time Sync...");

    // Sync Points Table
    supabaseClient
        .channel('public:points_table')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'points_table' }, () => {
            console.log("🔄 Points Table Updated! Syncing...");
            loadPointsTable();
        })
        .subscribe((status) => {
            console.log(`📡 Points Table Sync Status: ${status}`);
        });

    // Sync Match Center (Hero Content)
    supabaseClient
        .channel('hero_home_sync')
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'hero_content',
            filter: `id=eq.${MATCH_MAP['live-match']}` 
        }, (payload) => {
            console.log("⚡ [REALTIME] Live Score Update Received!", payload.new);
            handleLiveScoreUpdate(payload.new);
        })
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'hero_content'
        }, () => {
            console.log("🔄 Hero Content changed. Refreshing all...");
            loadHeroAndScores();
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') showLiveSyncIndicator(true);
            else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') showLiveSyncIndicator(false);
        });

    // Sync Notices
    supabaseClient
        .channel('public:notices')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => {
            console.log("🔄 Notices Updated! Syncing...");
            loadNotices();
            loadLeaderboard();
        })
        .subscribe();

    // Sync Fixtures (Recent Result / Next Match)
    supabaseClient
        .channel('public:fixtures_home_sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'fixtures' }, () => {
            console.log("🔄 Fixture Data Changed! Refreshing Match Center...");
            loadHeroAndScores();
        })
        .subscribe();

    // Sync Auction Status
    supabaseClient
        .channel('public:auction_home_sync')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'auction_settings' }, () => {
            console.log("🔄 Auction Status Changed! Refreshing...");
            checkLiveAuction();
        })
        .subscribe();

    // Sync Live Alerts (Broadcast)
    supabaseClient
        .channel('match-updates')
        .on('broadcast', { event: 'live-alert' }, (payload) => {
            console.log("📢 Live Alert Received!", payload);
            showLiveNotification(payload.payload.message);
        })
        .subscribe();

    // 🚀 Fallback Polling is now global in loadHomepageContent to be more robust
}

async function checkLiveAuction() {
    try {
        const { data } = await supabaseClient
            .from('auction_settings')
            .select('*')
            .eq('id', 'global')
            .single();

        if (data && data.status === 'bidding') {
            showAuctionNotice(true);
        } else {
            showAuctionNotice(false);
        }
    } catch (err) {
        console.error("Auction Check Error:", err);
    }
}

function showAuctionNotice(active) {
    let notice = document.getElementById('auction-live-notice');
    if (active) {
        if (!notice) {
            notice = document.createElement('div');
            notice.id = 'auction-live-notice';
            notice.className = 'glass animate-fade';
            notice.style.cssText = `
                position: fixed; bottom: 100px; left: 20px; z-index: 1000;
                padding: 15px 25px; border: 2px solid var(--secondary);
                background: rgba(0, 242, 255, 0.1); border-radius: 50px;
                display: flex; align-items: center; gap: 15px;
                box-shadow: 0 10px 30px rgba(0, 242, 255, 0.2);
            `;
            notice.innerHTML = `
                <span class="pulse-dot"></span>
                <div style="font-weight: 800; font-size: 0.9rem;">
                    PLAYER AUCTION IS <span style="color: var(--secondary);">LIVE!</span>
                </div>
                <a href="auction.html" class="btn" style="padding: 8px 15px; font-size: 0.75rem;">Join Auction🔨</a>
            `;
            document.body.appendChild(notice);
        }
    } else if (notice) {
        notice.remove();
    }
}


async function loadSiteSettings() {
    const { data } = await window.safeSupabaseCall(() =>
        supabaseClient
            .from('site_settings')
            .select('*')
            .eq('id', 'global-settings')
            .single()
    );

    if (data) {
        console.log("Site Settings Loaded:", data);

        // Update Call links
        if (data.mobile1) document.getElementById('home-call1').href = `tel:${data.mobile1}`;
        if (data.mobile2) document.getElementById('home-call2').href = `tel:${data.mobile2}`;

        // Update WhatsApp links
        if (data.whatsapp1) document.getElementById('home-wa1').href = `https://wa.me/91${data.whatsapp1}`;
        if (data.whatsapp2) document.getElementById('home-wa2').href = `https://wa.me/91${data.whatsapp2}`;

        // Socials
        const emailEl = document.getElementById('home-email');
        const fbEl = document.getElementById('home-facebook');
        if (data.email && emailEl) emailEl.href = `mailto:${data.email}`;
        if (data.facebook_url && fbEl) fbEl.href = ensureAbsoluteUrl(data.facebook_url);

        // Map URL
        const mapBtn = document.getElementById('home-map-link');
        if (data.map_url && mapBtn) mapBtn.href = ensureAbsoluteUrl(data.map_url);

        // Store registration end date for countdown
        window.siteRegEndDate = data.reg_end_date;

        // QR Code
        const qrContainer = document.getElementById('display-qr-container');
        if (qrContainer) {
            if (data.qr_code_url) {
                qrContainer.innerHTML = `<img src="${data.qr_code_url}" style="width: 100%; border-radius: 10px; background: white; padding: 5px;">`;
            } else {
                qrContainer.innerHTML = '<p style="color: #666; font-size: 0.8rem;">Coming Soon</p>';
            }
        }
    }
}

const MATCH_MAP = {
    'live-match': '00000000-0000-0000-0000-000000000001',
    'upcoming-match': '00000000-0000-0000-0000-000000000002',
    'recent-match': '00000000-0000-0000-0000-000000000003',
    'main-hero': '00000001-0001-0001-0001-000000000000'
};

// --- PARTICLES BACKGROUND ---
function initParticles() {
    const container = document.getElementById('particles-bg');
    if (!container) return;

    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';

        const size = Math.random() * 5 + 2 + 'px';
        particle.style.width = size;
        particle.style.height = size;

        particle.style.left = Math.random() * 100 + 'vw';
        particle.style.top = Math.random() * 100 + 'vh';

        particle.style.animationDuration = Math.random() * 15 + 10 + 's';
        particle.style.animationDelay = Math.random() * 5 + 's';

        container.appendChild(particle);
    }
}

async function loadHeroAndScores() {
    console.log("Fetching Match Center data...");

    // 1. Fetch all match types in parallel using valid UUIDs
    const matchKeys = Object.keys(MATCH_MAP);
    const results = await Promise.all(matchKeys.map(key =>
        window.safeSupabaseCall(() =>
            supabaseClient.from('hero_content').select('*').eq('id', MATCH_MAP[key]).single()
        )
    ));

    const matches = {};
    results.forEach((res, index) => {
        if (res.data) matches[matchKeys[index]] = res.data;
    });

    // 2. Update Hero Text (from main-hero or live-match fallback)
    const heroData = matches['main-hero'] || matches['live-match'];
    if (heroData) {
        if (heroData.title) document.getElementById('display-hero-title').innerHTML = heroData.title;
        if (heroData.subtitle) document.getElementById('display-hero-subtitle').innerText = heroData.subtitle;
    }

    // 3. Render Live Match
    const live = matches['live-match'];
    const liveContainer = document.getElementById('live-score-container');
    if (live && live.team1_name && live.team2_name) {
        liveContainer.style.display = 'block';

        // Use the new pulse indicator
        const badge = document.getElementById('display-live-badge');
        badge.innerHTML = `<span class="pulse-dot"></span> ${live.badge || "LIVE MATCH"}`;
        badge.className = "live-indicator";
        badge.style.animation = "none"; // Remove blink animation in favor of pulse-dot

        document.getElementById('display-live-team1').className = "tv-score-team";
        document.getElementById('display-live-team1').innerText = live.team1_name;
        document.getElementById('display-live-score1').className = "gradient-text tv-score-main";
        document.getElementById('display-live-score1').innerText = live.team1_score || 0;

        document.getElementById('display-live-team2').className = "tv-score-team";
        document.getElementById('display-live-team2').innerText = live.team2_name;
        document.getElementById('display-live-score2').className = "gradient-text tv-score-main";
        document.getElementById('display-live-score2').innerText = live.team2_score || 0;

        const statusEl = document.getElementById('display-live-status');
        statusEl.innerText = live.match_status || "";
        statusEl.style.textShadow = "0 0 10px rgba(0, 255, 163, 0.3)";

        // Detailed Score (Wickets, Overs, Balls)
        if (document.getElementById('display-live-wickets')) {
            const is2ndInning = live.badge?.includes('TARGET');
            
            // Show stats for the CURRENT batting team
            const currentWickets = is2ndInning ? (live.team2_wickets || 0) : (live.wickets || 0);
            const currentOvers = is2ndInning ? (live.team2_overs || 0) : (live.overs || 0);
            const currentBalls = is2ndInning ? (live.team2_balls || 0) : (live.balls || 0);

            document.getElementById('display-live-wickets').innerText = currentWickets;
            document.getElementById('display-live-overs').innerText = currentOvers;
            document.getElementById('display-live-balls').innerText = currentBalls;

            // --- PROFESSIONAL CHASE DISPLAY ---
            const statusEl = document.getElementById('display-live-status');
            const targetWrap = document.getElementById('display-live-target-wrap');
            
            if (is2ndInning && live.target > 0) {
                const req = live.target - (live.team2_score || 0);
                const playedBalls = (live.team2_overs * 6) + live.team2_balls;
                const totalBalls = (live.max_overs || 6) * 6;
                const ballsLeft = Math.max(0, totalBalls - playedBalls);

                if (statusEl) {
                    if (req <= 0) {
                        statusEl.innerText = `${live.team2_name} won the match! 🏆`;
                        statusEl.style.color = "var(--secondary)";
                    } else if (ballsLeft <= 0 && req > 0) {
                        statusEl.innerText = `${live.team1_name} won the match! 🏆`;
                        statusEl.style.color = "#ef4444";
                    } else {
                        statusEl.innerText = `${live.team2_name} needs ${req} from ${ballsLeft} balls.`;
                        statusEl.style.color = "white";
                    }
                }
                
                if (targetWrap) {
                    targetWrap.style.display = 'block';
                    document.getElementById('display-live-target').innerText = live.target;
                }
            } else {
                if (targetWrap) targetWrap.style.display = 'none';
                if (statusEl) statusEl.innerText = live.match_status || "Match Highlights LIVE";
            }

            // Batsman
            const batsmanWrap = document.getElementById('display-live-batsman-wrap');
            if (live.batsman1 && batsmanWrap) {
                batsmanWrap.style.display = 'block';
                const runs = live.batsman1_runs || 0;
                const balls = live.batsman1_balls || 0;
                document.getElementById('display-live-batsman').innerHTML = `
                    <span class="batsman-name">${live.batsman1}</span> 
                    <span class="batsman-score">${runs} (${balls})</span>
                `;
            } else if (batsmanWrap) {
                batsmanWrap.style.display = 'none';
            }
        }
        
        // Final fallback: Ensure it's shown if we got here
        liveContainer.style.display = 'block';
    } else {
        if (liveContainer) liveContainer.style.display = 'none';
    }

    // 4. Render Upcoming Match
    const up = matches['upcoming-match'];
    const upContainer = document.getElementById('upcoming-container');
    if (up && up.team1_name && up.team2_name) {
        upContainer.style.display = 'block';
        document.getElementById('display-up-team1').innerText = up.team1_name;
        document.getElementById('display-up-team2').innerText = up.team2_name;
        document.getElementById('display-up-status').innerText = up.match_status || "";
    } else {
        upContainer.style.display = 'none';
    }

    // 5. Render Recent Match (Fetch ACTUAL last result from Fixtures)
    const { data: lastMatch } = await window.safeSupabaseCall(() =>
        supabaseClient
            .from('fixtures')
            .select('*')
            .eq('status', 'completed')
            .order('match_no', { ascending: false })
            .limit(1)
            .single()
    );

    const recentContainer = document.getElementById('recent-container');
    if (lastMatch && recentContainer) {
        console.log("Rendering Latest Result:", lastMatch.team1, "vs", lastMatch.team2);
        recentContainer.style.display = 'block';
        document.getElementById('display-recent-team1').innerText = lastMatch.team1;
        document.getElementById('display-recent-score1').innerText = lastMatch.t1_score || 0;
        document.getElementById('display-recent-detail1').innerText = `(${lastMatch.t1_wickets || 0}/6.0)`;

        document.getElementById('display-recent-team2').innerText = lastMatch.team2;
        document.getElementById('display-recent-score2').innerText = lastMatch.t2_score || 0;
        document.getElementById('display-recent-detail2').innerText = `(${lastMatch.t2_wickets || 0}/6.0)`;

        const winnerStr = lastMatch.winner || "Match Completed";
        const winnerText = winnerStr === 'Draw' ? "MATCH TIED" : `${winnerStr.toUpperCase()} WON`;
        document.getElementById('display-recent-status').innerText = winnerText;
    } else {
        console.log("No completed matches found for homepage 'Latest Result' section.");
        if (recentContainer) recentContainer.style.display = 'none';
    }

    // Global Map Link is handled in loadSiteSettings
}

function handleLiveScoreUpdate(data) {
    if (!data) return;
    
    // Update only the necessary DOM elements for maximum performance
    const score1 = document.getElementById('display-live-score1');
    const score2 = document.getElementById('display-live-score2');
    const wkt = document.getElementById('display-live-wickets');
    const overs = document.getElementById('display-live-overs');
    const balls = document.getElementById('display-live-balls');
    const status = document.getElementById('display-live-status');
    const batWrap = document.getElementById('display-live-batsman-wrap');
    const batName = document.getElementById('display-live-batsman');

    if (score1) score1.innerText = data.team1_score || 0;
    if (score2) score2.innerText = data.team2_score || 0;
    if (wkt) wkt.innerText = data.wickets || 0;
    if (overs) overs.innerText = data.overs || 0;
    if (balls) balls.innerText = data.balls || 0;
    if (status) status.innerText = data.match_status || "Live Score Updating...";

    // 🎯 ENSURE VISIBILITY
    const container = document.getElementById('live-score-container');
    if (container && data.team1_name && data.team2_name) {
        container.style.display = 'block';
        
        // Update teams if they were missing
        const t1 = document.getElementById('display-live-team1');
        const t2 = document.getElementById('display-live-team2');
        if (t1) t1.innerText = data.team1_name;
        if (t2) t2.innerText = data.team2_name;
    }

    // 🎯 TARGET Logic
    const targetWrap = document.getElementById('display-live-target-wrap');
    const targetVal = document.getElementById('display-live-target');
    if (targetWrap && targetVal) {
        if (data.target > 0) {
            targetWrap.style.display = 'block';
            targetVal.innerText = data.target;
        } else {
            targetWrap.style.display = 'none';
        }
    }

    if (data.batsman1 && batWrap && batName) {
        batWrap.style.display = 'block';
        batName.innerHTML = `<span class="batsman-name">${data.batsman1}</span> <span class="batsman-score">${data.batsman1_runs || 0} (${data.batsman1_balls || 0})</span>`;
    }

    // Add a quick flash effect to show it updated
    if (container) {
        container.style.borderColor = 'var(--secondary)';
        setTimeout(() => container.style.borderColor = 'var(--primary)', 300);
    }
}

function showLiveSyncIndicator(active) {
    let indicator = document.getElementById('live-sync-indicator');
    if (active) {
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'live-sync-indicator';
            indicator.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.6); padding: 5px 12px; border-radius: 20px; border: 1px solid rgba(0,242,255,0.3); font-size: 0.7rem; color: #00f2ff; font-weight: 700;">
                    <span class="pulse-dot" style="width: 8px; height: 8px;"></span> LIVE SYNC ACTIVE
                </div>
            `;
            indicator.style.cssText = "position: fixed; top: 80px; right: 20px; z-index: 999; pointer-events: none;";
            document.body.appendChild(indicator);
        }
    } else if (indicator) {
        indicator.remove();
    }
}

window.allTeamsData = []; // Global store for team details

async function loadPointsTable() {
    const listA = document.getElementById('points-group-a');
    const listB = document.getElementById('points-group-b');
    if (!listA && !listB) return;

    console.log("Fetching Group Standings...");
    const { data, error } = await window.safeSupabaseCall(() =>
        supabaseClient
            .from('points_table')
            .select('*')
            .order('points', { ascending: false })
            .order('won', { ascending: false })
            .order('nrr', { ascending: false })
    );

    if (error) {
        console.error('Points Table Error:', error.message);
        return;
    }

    if (!data || data.length === 0) return;
    window.allTeamsData = data; // Store globally

    const groupA = data.filter(t => (t.group_name || 'A').toUpperCase() === 'A');
    const groupB = data.filter(t => (t.group_name || '').toUpperCase() === 'B');

    const renderRows = (teams) => {
        if (teams.length === 0) return '<tr><td colspan="6" style="padding:20px; color:var(--text-dim);">No teams assigned.</td></tr>';
        return teams.map((team, index) => {
            const logo = team.logo_url ? `<img src="${team.logo_url}" style="width: 25px; height: 25px; border-radius: 50%; object-fit: cover;">` : '🛡️';
            // Find global index
            const globalIndex = window.allTeamsData.findIndex(t => t.id === team.id);
            return `
                <tr>
                    <td>${index + 1}</td>
                    <td style="text-align: left; font-weight: 600; cursor: pointer;" onclick="showTeamProfileByIndex(${globalIndex})">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            ${logo}
                            <div style="font-size: 0.9rem;">${team.team_name}</div>
                        </div>
                    </td>
                    <td>${team.played}</td>
                    <td>${team.won}</td>
                    <td style="color: ${parseFloat(team.nrr) >= 0 ? 'var(--secondary)' : '#ff4d4d'}; font-size: 0.8rem;">
                        ${parseFloat(team.nrr) >= 0 ? '+' : ''}${team.nrr || '0.000'}
                    </td>
                    <td style="color: var(--secondary); font-weight: 800;">${team.points}</td>
                </tr>
            `;
        }).join('');
    };

    if (listA) listA.innerHTML = renderRows(groupA);
    if (listB) listB.innerHTML = renderRows(groupB);
}

// --- TEAM PROFILE MODAL LOGIC ---
function showTeamProfileByIndex(index) {
    const team = window.allTeamsData[index];
    if (!team) return;

    console.log("🏆 Opening Profile for:", team.team_name);
    const modal = document.getElementById('team-modal');

    document.getElementById('team-modal-name').innerText = team.team_name;

    // Support Multiple Owners
    const owners = Array.isArray(team.owners) ? team.owners : (team.owner_name ? [{ name: team.owner_name, photo: team.owner_photo }] : []);
    const ownerEl = document.getElementById('team-modal-owner');

    if (owners.length > 0) {
        ownerEl.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">
                ${owners.map(o => `
                    <div style="display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 12px;">
                        <img src="${o.photo || 'img.svg'}" style="width: 35px; height: 35px; border-radius: 50%; border: 1px solid var(--primary);">
                        <div style="text-align: left;">
                            <div style="font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase;">Owner</div>
                            <div style="font-weight: 700; color: white; line-height: 1;">${o.name}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        ownerEl.innerText = "TBD";
    }

    const logoImg = document.getElementById('team-modal-logo');
    if (team.logo_url) {
        logoImg.src = team.logo_url;
        logoImg.style.display = 'block';
    } else {
        logoImg.src = 'IMG.svg'; // Fallback
    }

    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
}

function closeTeamProfile() {
    const modal = document.getElementById('team-modal');
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
}

async function loadLeaderboard() {
    const orangeList = document.getElementById('orange-cap-list');
    const purpleList = document.getElementById('purple-cap-list');
    if (!orangeList || !purpleList) return;

    try {
        const { data, error } = await window.safeSupabaseCall(() =>
            supabaseClient
                .from('top_performers')
                .select('*')
                .order('runs', { ascending: false })
                .order('wickets', { ascending: false })
        );

        if (error) throw error;

        const orangeData = data
            .filter(p => p.category === 'batsman')
            .sort((a, b) => (b.runs || 0) - (a.runs || 0))
            .slice(0, 5);
        const purpleData = data
            .filter(p => p.category === 'bowler')
            .sort((a, b) => (b.wickets || 0) - (a.wickets || 0))
            .slice(0, 5);

        const renderItems = (items, type) => {
            if (items.length === 0) return '<p style="text-align: center; color: var(--text-dim); padding: 20px;">Results pending...</p>';
            return items.map((p, i) => `
                <div class="leaderboard-item animate-fade ${i === 0 ? 'gold-glow' : ''}">
                    <div class="leader-rank">${i + 1}</div>
                    <div class="player-info">
                        <h4 style="font-weight: 700; color: white;">${p.player_name}</h4>
                        <p style="font-size: 0.75rem; color: var(--secondary); opacity: 0.8;">${p.team_name || 'Individual'}</p>
                    </div>
                    <div class="stat-value" style="color: var(--secondary); font-size: 1.2rem; font-weight: 900;">
                        ${type === 'runs' ? p.runs : p.wickets}
                        <span style="font-size: 0.7rem; color: var(--text-dim); font-weight: 400; margin-left: 4px;">${type === 'runs' ? 'RUNS' : 'WKTS'}</span>
                    </div>
                </div>
            `).join('');
        };

        orangeList.innerHTML = renderItems(orangeData, 'runs');
        purpleList.innerHTML = renderItems(purpleData, 'wickets');

    } catch (err) {
        console.error("Leaderboard Error:", err);
    }
}


async function startCountdown() {
    // Wait a bit to ensure site settings are loaded if they are still pending
    let attempts = 0;
    while (!window.siteRegEndDate && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 300));
        attempts++;
    }

    const dateStr = window.siteRegEndDate || "February 27, 2026 18:00:00"; // Fallback to old hardcoded date
    const targetDate = new Date(dateStr).getTime();
    const countdownWrap = document.getElementById('countdown-wrap');

    if (!countdownWrap) return;

    const daysEl = document.getElementById("days");
    const hoursEl = document.getElementById("hours");
    const minutesEl = document.getElementById("minutes");
    const secondsEl = document.getElementById("seconds");

    const timer = setInterval(() => {
        const now = new Date().getTime();
        const distance = targetDate - now;

        if (distance < 0) {
            clearInterval(timer);
            countdownWrap.innerHTML = `
                <p style="color: var(--primary); font-size: 1.1rem; font-weight: 800; text-transform: uppercase; letter-spacing: 2px;">
                    🚫 REGISTRATION CLOSED
                </p>
            `;
            const regBtn = document.querySelector('.btn-red-blink');
            if (regBtn) {
                regBtn.innerText = "Registration Closed";
                regBtn.style.pointerEvents = "none";
                regBtn.style.opacity = "0.5";
                regBtn.classList.remove('btn-red-blink');
            }
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        if (daysEl) daysEl.innerText = days.toString().padStart(2, '0');
        if (hoursEl) hoursEl.innerText = hours.toString().padStart(2, '0');
        if (minutesEl) minutesEl.innerText = minutes.toString().padStart(2, '0');
        if (secondsEl) secondsEl.innerText = seconds.toString().padStart(2, '0');
    }, 1000);
}

async function loadGallery() {
    const track = document.getElementById('gallery-track');
    if (!track) return;

    try {
        const { data, error } = await window.safeSupabaseCall(() =>
            supabaseClient
                .from('gallery')
                .select('image_url, orientation, name, designation')
                .order('created_at', { ascending: false })
        );

        if (error) throw error;

        let galleryItems = [];
        if (data && data.length > 0) {
            galleryItems = data;
        } else {
            // Fallback placeholder images if gallery is empty
            galleryItems = [
                { image_url: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&q=80", orientation: 'landscape' },
                { image_url: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80", orientation: 'landscape' },
                { image_url: "https://images.unsplash.com/photo-1593341646782-e0b495cff86d?w=800&q=80", orientation: 'portrait' }
            ];
        }

        const galleryHtml = galleryItems.map(item => `
            <div class="gallery-item ${item.orientation || 'landscape'}" onclick="openLightbox('${item.image_url}', '${item.name || ''}', '${item.designation || ''}')">
                <img src="${item.image_url}" alt="${item.name || 'Tournament Photo'}">
                ${(item.name || item.designation) ? `
                <div class="gallery-label">
                    ${item.name ? `<h4>${item.name}</h4>` : ''}
                    ${item.designation ? `<p>${item.designation}</p>` : ''}
                </div>
                ` : ''}
            </div>
        `).join('');

        // Duplicate for infinity scroll
        track.innerHTML = galleryHtml + galleryHtml;
    } catch (err) {
        console.error("Gallery Load Error:", err);
    }
}

function openLightbox(url, name = '', role = '') {
    const lightbox = document.getElementById('image-lightbox');
    const img = document.getElementById('lightbox-img');
    const caption = document.getElementById('lightbox-caption');
    const nameEl = document.getElementById('lightbox-name');
    const roleEl = document.getElementById('lightbox-role');

    if (lightbox && img) {
        img.src = url;
        
        if (name || role) {
            if (nameEl) nameEl.innerText = name;
            if (roleEl) roleEl.innerText = role;
            if (caption) caption.style.display = 'block';
        } else {
            if (caption) caption.style.display = 'none';
        }

        lightbox.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Stop scrolling
    }
}

function closeLightbox() {
    const lightbox = document.getElementById('image-lightbox');
    if (lightbox) {
        lightbox.style.display = 'none';
        document.body.style.overflow = 'auto'; // Restore scrolling
    }
}

// Reliable Initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadHomepageContent);
} else {
    loadHomepageContent();
}
async function loadSponsors() {
    const track = document.getElementById('sponsor-track-dynamic');
    if (!track) return;

    try {
        const { data, error } = await supabaseClient
            .from('sponsors')
            .select('*')
            .eq('is_active', true)
            .order('priority', { ascending: false });

        if (error || !data || data.length === 0) {
            return;
        }

        const itemsHtml = data.map(s => {
            const logoContent = s.logo_url 
                ? `<img src="${s.logo_url}" alt="${s.name}" class="sponsor-logo" style="max-height: 80px; width: auto; object-fit: contain; filter: drop-shadow(0 0 10px rgba(255,255,255,0.1));">` 
                : `<span class="sponsor-name" style="font-size: 1.5rem; font-weight: 900; background: linear-gradient(135deg, #fff, #888); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${s.name}</span>`;
            
            if (s.website_url) {
                let url = s.website_url.trim();
                if (!/^https?:\/\//i.test(url)) {
                    url = 'https://' + url;
                }
                return `
                    <div class="sponsor-item" style="padding: 0 40px;">
                        <a href="${url}" target="_blank" style="text-decoration: none; transition: transform 0.3s ease; display: inline-block;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                            ${logoContent}
                        </a>
                    </div>
                `;
            } else {
                return `
                    <div class="sponsor-item" style="padding: 0 40px;">
                        ${logoContent}
                    </div>
                `;
            }
        }).join('');

        track.innerHTML = itemsHtml + itemsHtml; 
    } catch (e) {
        console.warn("Sponsors load failed:", e.message);
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
