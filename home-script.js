async function loadHomepageContent() {
    console.log("🚀 Initializing SATPL Homepage...");
    initParticles();
    // 1. Initial Load
    await Promise.all([
        loadHeroAndScores(),
        loadPointsTable(),
        loadSiteSettings(),
        loadNotices(),
        loadLeaderboard(),
        loadGallery(),
        startCountdown()
    ]).catch(err => console.error("Initial Load Error:", err));

    // 2. Setup Real-time Sync (The "Bulletproof" Flow)
    setupRealtimeSync();
}

async function loadNotices() {
    const list = document.getElementById('notice-list');
    const popup = document.getElementById('notice-popup');

    try {
        // 1. Fetch notices and site settings in parallel
        const [noticesRes, settingsRes] = await Promise.all([
            supabaseClient
                .from('notices')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(5),
            supabaseClient
                .from('site_settings')
                .select('is_popup_enabled, featured_notice_id')
                .eq('id', 'global-settings')
                .single()
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
                const { data: specificNotice } = await supabaseClient
                    .from('notices')
                    .select('*')
                    .eq('id', featuredNoticeId)
                    .single();
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
        .subscribe();

    // Sync Match Center (Hero Content)
    supabaseClient
        .channel('public:hero_content')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'hero_content' }, () => {
            console.log("🔄 Match Center Updated! Syncing...");
            loadHeroAndScores();
        })
        .subscribe();

    // Sync Notices
    supabaseClient
        .channel('public:notices')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => {
            console.log("🔄 Notices Updated! Syncing...");
            loadNotices();
            loadLeaderboard();
        })
        .subscribe();
}


async function loadSiteSettings() {
    const { data } = await supabaseClient
        .from('site_settings')
        .select('*')
        .eq('id', 'global-settings')
        .single();

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
        if (data.facebook_url && fbEl) fbEl.href = data.facebook_url;

        // Map URL
        const mapBtn = document.getElementById('home-map-link');
        if (data.map_url && mapBtn) mapBtn.href = data.map_url;

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
        supabaseClient.from('hero_content').select('*').eq('id', MATCH_MAP[key]).single()
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

        document.getElementById('display-live-team1').innerText = live.team1_name;
        document.getElementById('display-live-score1').innerText = live.team1_score || 0;
        document.getElementById('display-live-team2').innerText = live.team2_name;
        document.getElementById('display-live-score2').innerText = live.team2_score || 0;
        document.getElementById('display-live-status').innerText = live.match_status || "";

        // Detailed Score
        if (document.getElementById('display-live-wickets')) {
            document.getElementById('display-live-wickets').innerText = live.wickets || 0;
            document.getElementById('display-live-overs').innerText = live.overs || 0;
            document.getElementById('display-live-balls').innerText = live.balls || 0;

            // Target
            const targetWrap = document.getElementById('display-live-target-wrap');
            if (live.target > 0) {
                targetWrap.style.display = 'block';
                document.getElementById('display-live-target').innerText = live.target;
            } else {
                targetWrap.style.display = 'none';
            }

            // Batsman
            const batsmanWrap = document.getElementById('display-live-batsman-wrap');
            if (live.batsman1) {
                batsmanWrap.style.display = 'block';
                const runs = live.batsman1_runs || 0;
                const balls = live.batsman1_balls || 0;
                document.getElementById('display-live-batsman').innerHTML = `
                    <span class="batsman-name">${live.batsman1}</span> 
                    <span class="batsman-score">${runs} (${balls})</span>
                `;
            } else {
                batsmanWrap.style.display = 'none';
            }
        }
    } else {
        liveContainer.style.display = 'none';
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

    // 5. Render Recent Match
    const recent = matches['recent-match'];
    const recentContainer = document.getElementById('recent-container');
    if (recent && recent.team1_name && recent.team2_name) {
        recentContainer.style.display = 'block';
        document.getElementById('display-recent-team1').innerText = recent.team1_name;
        document.getElementById('display-recent-score1').innerText = recent.team1_score || 0;
        document.getElementById('display-recent-team2').innerText = recent.team2_name;
        document.getElementById('display-recent-score2').innerText = recent.team2_score || 0;
        document.getElementById('display-recent-status').innerText = recent.match_status || "";
    } else {
        recentContainer.style.display = 'none';
    }

    // Global Map Button Update
    const globalHeroData = matches['live-match'] || matches['upcoming-match'] || matches['main-hero'];
    const mapBtn = document.getElementById('home-map-link');
    if (globalHeroData && globalHeroData.map_url && mapBtn) {
        mapBtn.href = globalHeroData.map_url;
    }
}

async function loadPointsTable() {
    const list = document.getElementById('home-points-list');
    if (!list) return;

    console.log("Fetching Standings...");
    const { data, error } = await supabaseClient
        .from('points_table')
        .select('*')
        .order('points', { ascending: false })
        .order('won', { ascending: false });

    if (error) {
        console.error('Points Table Error:', error.message);
        list.innerHTML = `<tr><td colspan="6" style="color: #ff4d8d; padding: 20px;">Connection Error: ${error.message}</td></tr>`;
        return;
    }

    if (!data || data.length === 0) {
        list.innerHTML = `<tr><td colspan="6" style="color: var(--text-dim); padding: 20px;">Standings will be updated soon.</td></tr>`;
        return;
    }

    list.innerHTML = data.map((team, index) => {
        const logo = team.logo_url ? `<img src="${team.logo_url}" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.1);">` : '<span class="stat-icon">🛡️</span>';
        return `
            <tr>
                <td>${index + 1}</td>
                <td style="text-align: left; font-weight: 600;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        ${logo}
                        <div>
                            <div style="font-size: 1rem;">${team.team_name}</div>
                            ${team.owner_name ? `<div style="font-size: 0.7rem; color: var(--text-dim); font-weight: 400;">Owner: ${team.owner_name}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td>${team.played}</td>
                <td>${team.won}</td>
                <td>${team.lost}</td>
                <td style="color: var(--secondary); font-weight: 800;">${team.points}</td>
            </tr>
        `;
    }).join('');
}

async function loadLeaderboard() {
    const orangeList = document.getElementById('orange-cap-list');
    const purpleList = document.getElementById('purple-cap-list');
    if (!orangeList || !purpleList) return;

    try {
        const { data, error } = await supabaseClient
            .from('top_performers')
            .select('*')
            .order('runs', { ascending: false })
            .order('wickets', { ascending: false });

        if (error) throw error;

        const orangeData = data.filter(p => p.category === 'batsman').slice(0, 5);
        const purpleData = data.filter(p => p.category === 'bowler').slice(0, 5);

        const renderItems = (items, type) => {
            if (items.length === 0) return '<p style="text-align: center; color: var(--text-dim); padding: 20px;">Results pending...</p>';
            return items.map(p => `
                <div class="leaderboard-item">
                    <div class="player-info">
                        <h4>${p.player_name}</h4>
                        <p>${p.team_name || ''}</p>
                    </div>
                    <div class="stat-value">${type === 'runs' ? p.runs : p.wickets}</div>
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
        const { data, error } = await supabaseClient
            .from('gallery')
            .select('image_url, orientation')
            .order('created_at', { ascending: false });

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
            <div class="gallery-item ${item.orientation || 'landscape'}" onclick="openLightbox('${item.image_url}')">
                <img src="${item.image_url}" alt="Tournament Photo">
            </div>
        `).join('');

        // Duplicate for infinity scroll
        track.innerHTML = galleryHtml + galleryHtml;
    } catch (err) {
        console.error("Gallery Load Error:", err);
    }
}

function openLightbox(url) {
    const lightbox = document.getElementById('image-lightbox');
    const img = document.getElementById('lightbox-img');
    if (lightbox && img) {
        img.src = url;
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

document.addEventListener('DOMContentLoaded', loadHomepageContent);
