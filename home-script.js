async function loadHomepageContent() {
    console.log("🚀 Initializing SATPL Homepage...");

    // 1. Load Hero & Scores
    loadHeroAndScores().catch(err => console.error("Hero Load Error:", err));

    // Load Points Table
    await loadPointsTable();

    // Load Site Settings
    await loadSiteSettings();
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
        if (data.email) document.getElementById('home-email').href = `mailto:${data.email}`;
        if (data.facebook_url) document.getElementById('home-facebook').href = data.facebook_url;

        // QR Code
        const qrContainer = document.getElementById('display-qr-container');
        if (data.qr_code_url) {
            qrContainer.innerHTML = `<img src="${data.qr_code_url}" style="width: 250px; height: 250px; border-radius: 20px; border: 5px solid rgba(255,255,255,0.05); background: white; padding: 10px;">`;
        } else {
            qrContainer.innerHTML = '<p style="color: var(--text-dim);">Coming Soon</p>';
        }
    }
}

const MATCH_MAP = {
    'live-match': '00000000-0000-0000-0000-000000000001',
    'upcoming-match': '00000000-0000-0000-0000-000000000002',
    'recent-match': '00000000-0000-0000-0000-000000000003',
    'main-hero': '00000001-0001-0001-0001-000000000000'
};

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
        document.getElementById('display-live-badge').innerText = live.badge || "LIVE MATCH";
        document.getElementById('display-live-team1').innerText = live.team1_name;
        document.getElementById('display-live-score1').innerText = live.team1_score || 0;
        document.getElementById('display-live-team2').innerText = live.team2_name;
        document.getElementById('display-live-score2').innerText = live.team2_score || 0;
        document.getElementById('display-live-status').innerText = live.match_status || "";

        // NEW: Detailed Score (Wickets, Overs, Balls)
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
                document.getElementById('display-live-batsman').innerText = live.batsman1;
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
        console.warn('No teams found in points_table');
        list.innerHTML = `<tr><td colspan="6" style="color: var(--text-dim); padding: 20px;">Standings will be updated soon.</td></tr>`;
        return;
    }

    console.log("Standings fetched successfully:", data.length, "teams");

    list.innerHTML = data.map((team, index) => `
        <tr>
            <td>${index + 1}</td>
            <td style="text-align: left; font-weight: 600;">${team.team_name}</td>
            <td>${team.played}</td>
            <td>${team.won}</td>
            <td>${team.lost}</td>
            <td style="color: var(--secondary); font-weight: 800;">${team.points}</td>
        </tr>
    `).join('');
}

document.addEventListener('DOMContentLoaded', loadHomepageContent);
