// ================= SCORER AUTH CHECK & SESSION MANAGEMENT =================
let lastScorerActivity = Date.now();
const SCORER_INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

function checkScorerAuth() {
    const session = localStorage.getItem('satpl_scorer_session');
    if (!session) {
        window.location.href = 'scorer-login.html';
        return null;
    }
    const userData = JSON.parse(session);

    // Initial check (keeping it for safety)
    if (Date.now() - lastScorerActivity > SCORER_INACTIVITY_TIMEOUT) {
        logoutScorer();
        return null;
    }
    return userData;
}

function updateScorerActivity() {
    lastScorerActivity = Date.now();
}

// Track activity
['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, updateScorerActivity, true);
});

// Check for inactivity every minute
setInterval(() => {
    if (localStorage.getItem('satpl_scorer_session')) {
        if (Date.now() - lastScorerActivity > SCORER_INACTIVITY_TIMEOUT) {
            console.log("Scorer session timed out due to inactivity.");
            logoutScorer();
        }
    }
}, 60000); // Check every 60 seconds

const currentUser = checkScorerAuth();
if (currentUser) {
    const display = document.getElementById('scorer-name-display');
    if (display) display.innerText = `Logged in as: ${currentUser.name}`;
}

function logoutScorer() {
    localStorage.removeItem('satpl_scorer_session');
    window.location.href = 'scorer-login.html';
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
let allPaidPlayers = [];

async function initScorer() {
    await loadScoringSection();
    fetchPlayersForAutocomplete();
}

async function fetchPlayersForAutocomplete() {
    try {
        const { data, error } = await supabaseClient
            .from('player_registrations')
            .select('id, registration_no, player_name, photo_url, payment_status')
            .in('payment_status', ['paid', 'completed']);

        if (!error && data) {
            allPaidPlayers = data;
        }
    } catch (e) {
        console.error("Error fetching players for autocomplete:", e);
    }
}

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

    const p1Box = document.getElementById('player-1-box');
    const p2Box = document.getElementById('player-2-box');

    if (p1Box) {
        p1Box.style.border = liveMatchState.striker === 1 ? '2px solid var(--secondary)' : '1px solid rgba(255,255,255,0.05)';
        if (liveMatchState.striker === 1) p1Box.classList.remove('player-inactive');
        else p1Box.classList.add('player-inactive');
    }

    if (p2Box) {
        p2Box.style.border = liveMatchState.striker === 2 ? '2px solid var(--secondary)' : '1px solid rgba(255,255,255,0.05)';
        if (liveMatchState.striker === 2) p2Box.classList.remove('player-inactive');
        else p2Box.classList.add('player-inactive');
    }

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

    const dropId = type === 1 ? 'score-p1-dropdown' : type === 2 ? 'score-p2-dropdown' : 'score-bowl-dropdown';
    const dropdown = document.getElementById(dropId);
    if (dropdown) dropdown.style.display = 'none';

    updateScoringUI();
}

async function updateTournamentCaps(name, team, cat, r, w, balls = 0, matches = 0) {
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
            balls: (existing.balls || 0) + balls,
            matches: (existing.matches || 0) + matches,
            team_name: team || existing.team_name
        }).eq('id', existing.id);
    } else {
        await supabaseClient.from('top_performers').insert([{
            player_name: name,
            team_name: team || 'Unknown',
            category: cat,
            runs: r,
            wickets: w,
            balls: balls,
            matches: matches
        }]);
    }
}

async function generateAutoCommentary(matchId, runVal, isWicket, extrasType, p1, p2, bowl) {
    let text = "";
    const pName = p1.name;

    if (isWicket) {
        text = `☝️ OUT! ${pName} is gone! Fantastic delivery by ${bowl.name}. What a breakthrough!`;
    } else if (runVal === 6) {
        text = `🚀 SIXER! ${pName} clears the boundary effortlessly! That's out of the park!`;
    } else if (runVal === 4) {
        text = `⚡ FOUR! Beautifully timed by ${pName}. It races away to the fence!`;
    } else if (extrasType === 'WD') {
        text = `⬅️ Wide Ball. Extra pressure on ${bowl.name} now.`;
    } else if (extrasType === 'NB') {
        text = `🔴 No Ball! Free hit opportunity for ${pName}!`;
    } else if (runVal === 0) {
        text = `🧤 Dot ball. Good comeback by ${bowl.name}.`;
    } else {
        text = `${pName} pushes it for ${runVal} run(s). Good rotation of strike.`;
    }

    try {
        await supabaseClient.from('match_commentary').insert([{
            match_id: matchId,
            commentary_text: text,
            ball_detail: `${liveMatchState.overs}.${liveMatchState.balls}`
        }]);
    } catch (e) {
        console.warn("Commentary push failed:", e.message);
    }

    if (runVal >= 4 || isWicket) {
        showLiveNotification(text);
        broadcastMatchEvent(text);
    }
}

function broadcastMatchEvent(msg) {
    const channel = supabaseClient.channel('match-updates');
    channel.send({
        type: 'broadcast',
        event: 'live-alert',
        payload: { message: msg }
    });
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

function filterScoringPlayers(query, type) {
    const dropId = type === 1 ? 'score-p1-dropdown' : type === 2 ? 'score-p2-dropdown' : 'score-bowl-dropdown';
    const dropdown = document.getElementById(dropId);
    const parentBox = type === 1 ? document.getElementById('player-1-box') : type === 2 ? document.getElementById('player-2-box') : null;

    if (!query || query.length < 1) {
        if (dropdown) dropdown.style.display = 'none';
        if (parentBox) parentBox.classList.remove('search-active-context');
        return;
    }

    if (parentBox) parentBox.classList.add('search-active-context');

    if (!allPaidPlayers || allPaidPlayers.length === 0) {
        fetchPlayersForAutocomplete();
        if (dropdown) {
            dropdown.innerHTML = '<div style="padding: 10px; color: var(--text-dim);">Loading...</div>';
            dropdown.style.display = 'block';
        }
        return;
    }

    query = query.toLowerCase().trim();
    const filtered = allPaidPlayers.filter(p =>
        (p.player_name && p.player_name.toLowerCase().includes(query)) ||
        (p.registration_no && p.registration_no.toLowerCase().includes(query))
    ).slice(0, 10);

    if (dropdown) {
        if (filtered.length === 0) {
            dropdown.innerHTML = '<div style="padding: 10px; color: var(--text-dim);">No matches</div>';
        } else {
            dropdown.innerHTML = filtered.map(p => `
                <div class="dropdown-item" onclick="selectScoringPlayer('${p.registration_no}', '${p.player_name.replace(/'/g, "\\'")}', ${type})">
                    <img src="${p.photo_url || 'img.jpg'}">
                    <div class="player-info">
                        <div class="player-name">${p.player_name}</div>
                        <div class="reg-no">REG: ${p.registration_no}</div>
                    </div>
                </div>
            `).join('');
        }
        dropdown.style.display = 'block';
    }
}

function selectScoringPlayer(regNo, name, type) {
    const regId = type === 1 ? 'score-p1-reg' : type === 2 ? 'score-p2-reg' : 'score-bowl-reg';
    const dropId = type === 1 ? 'score-p1-dropdown' : type === 2 ? 'score-p2-dropdown' : 'score-bowl-dropdown';

    const regInput = document.getElementById(regId);
    if (regInput) regInput.value = regNo;

    const dropdown = document.getElementById(dropId);
    if (dropdown) dropdown.style.display = 'none';

    const parentBox = type === 1 ? document.getElementById('player-1-box') : type === 2 ? document.getElementById('player-2-box') : null;
    if (parentBox) parentBox.classList.remove('search-active-context');

    if (type === 1) { liveMatchState.batsman1.name = name; liveMatchState.batsman1.reg = regNo; }
    else if (type === 2) { liveMatchState.batsman2.name = name; liveMatchState.batsman2.reg = regNo; }
    else { liveMatchState.bowler.name = name; liveMatchState.bowler.reg = regNo; }

    updateScoringUI();
}

function handleScoreAction(val) {
    scoreHistory.push(JSON.parse(JSON.stringify(liveMatchState)));
    if (scoreHistory.length > 20) scoreHistory.shift();
    redoHistory = [];

    const maxOvers = parseInt(document.getElementById('score-max-overs').value) || 6;
    const maxWkts = parseInt(document.getElementById('score-max-wkts').value) || 10;
    liveMatchState.max_overs = maxOvers;
    liveMatchState.max_wkts = maxWkts;

    if (liveMatchState.inning === 2 && liveMatchState.target > 0) {
        if (liveMatchState.runs >= liveMatchState.target) {
            alert(`${liveMatchState.team_name} WON THE MATCH! 🏆`);
            return;
        }
    }

    if (liveMatchState.overs >= maxOvers || liveMatchState.wkts >= maxWkts) {
        alert("Innings Over!");
        return;
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

    // 📡 GENERATE AUTO-COMMENTARY
    const fixtureId = document.getElementById('score-fixture-id')?.value;
    if (fixtureId) {
        const strikerObj = liveMatchState.striker === 1 ? liveMatchState.batsman1 : liveMatchState.batsman2;
        generateAutoCommentary(fixtureId, runs, isWicket,
            isWide ? 'WD' : isNoBall ? 'NB' : '',
            strikerObj, {}, liveMatchState.bowler);
    }

    if (runs % 2 !== 0 && !isWide && !isNoBall) switchStrike();

    updateScoringUI();

    if (liveMatchState.inning === 2 && liveMatchState.target > 0) {
        if (liveMatchState.runs >= liveMatchState.target) {
            const winText = `MATCH COMPLETED: ${liveMatchState.team_name} WON! 🏆`;
            alert(winText);
            supabaseClient.from('hero_content').update({
                match_status: winText,
                badge: "COMPLETED"
            }).eq('id', '00000000-0000-0000-0000-000000000001');
        } else {
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

    const fixtureId = document.getElementById('score-fixture-id').value;
    if (fixtureId) {
        const is2ndInning = liveMatchState.inning === 2;
        const currentOvers = parseFloat(`${liveMatchState.overs}.${liveMatchState.balls}`);
        const fixtureSync = {
            t1_score: is2ndInning ? (liveMatchState.t1_score || (liveMatchState.target - 1)) : liveMatchState.runs,
            t1_wickets: is2ndInning ? (liveMatchState.t1_wickets || 10) : liveMatchState.wkts,
            t1_overs: is2ndInning ? (liveMatchState.t1_overs || 6.0) : currentOvers,
            t2_score: is2ndInning ? liveMatchState.runs : 0,
            t2_wickets: is2ndInning ? liveMatchState.wkts : 0,
            t2_overs: is2ndInning ? currentOvers : 0.0,
            status: 'live'
        };
        await supabaseClient.from('fixtures').update(fixtureSync).eq('id', fixtureId);
    }

    if (error) alert(error.message);
    else showSuccessPopup("Live Scorecard Updated Successfully! 🚀");
}

function resetInnings() {
    if (!confirm("Reset?")) return;
    resetInningsNoConfirm();
    updateScoringUI();
}

function undoLastBall() {
    if (scoreHistory.length === 0) return alert("No balls to undo!");
    redoHistory.push(JSON.parse(JSON.stringify(liveMatchState)));
    liveMatchState = scoreHistory.pop();
    updateScoringUI();
}

function redoLastBall() {
    if (redoHistory.length === 0) return alert("No balls to redo!");
    scoreHistory.push(JSON.parse(JSON.stringify(liveMatchState)));
    liveMatchState = redoHistory.pop();
    updateScoringUI();
}

async function startSecondInnings() {
    if (liveMatchState.wkts < liveMatchState.max_wkts && liveMatchState.overs < liveMatchState.max_overs) {
        if (!confirm("Innings not finished. Continue?")) return;
    }
    const firstInningsScore = liveMatchState.runs;
    const chasingTeam = liveMatchState.team2_name;
    if (!confirm(`Switch to 2nd Innings. Target: ${firstInningsScore + 1}?`)) return;

    liveMatchState.t1_score = firstInningsScore;
    liveMatchState.t1_overs = parseFloat(`${liveMatchState.overs}.${liveMatchState.balls}`);
    liveMatchState.t1_wickets = liveMatchState.wkts;

    liveMatchState.team_name = chasingTeam;
    liveMatchState.runs = 0; liveMatchState.wkts = 0; liveMatchState.overs = 0; liveMatchState.balls = 0;
    liveMatchState.batsman1 = { name: "Striker", runs: 0, balls: 0, f4s: 0, s6s: 0, reg: "" };
    liveMatchState.batsman2 = { name: "Non-Striker", runs: 0, balls: 0, f4s: 0, s6s: 0, reg: "" };
    liveMatchState.bowler = { name: "Bowler", runs: 0, wkts: 0, overs: 0, balls: 0, reg: "" };
    liveMatchState.timeline = [];
    scoreHistory = []; redoHistory = [];
    liveMatchState.inning = 2;
    liveMatchState.target = firstInningsScore + 1;

    updateScoringUI();
    await supabaseClient.from('hero_content').update({
        badge: `TARGET: ${firstInningsScore + 1}`,
        team1_score: 0, wickets: 0, overs: 0, balls: 0,
        match_status: `${chasingTeam} needs ${firstInningsScore + 1} runs to win.`
    }).eq('id', '00000000-0000-0000-0000-000000000001');
}

async function finalizeLiveMatch() {
    const winner = document.getElementById('score-winner-select').value;
    if (!winner) return alert("Select Winner!");
    const id = document.getElementById('score-fixture-id').value;
    if (!id) return alert("Select Fixture!");

    if (!confirm("Finalize Match?")) return;

    try {
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
        await supabaseClient.from('hero_content').update({
            badge: "RESULT",
            match_status: `${winner} won the match!`,
            team1_score: finalData.t1_score,
            team2_score: finalData.t2_score,
            wickets: finalData.t1_wickets,
            overs: finalData.t1_overs,
            balls: 0
        }).eq('id', '00000000-0000-0000-0000-000000000001');

        // 3. Update Tournament Caps (Analytics)
        if (topBat) await updateTournamentCaps(topBat, '', 'batsman', topBatRuns, 0, 0, 1);
        if (topBowl) await updateTournamentCaps(topBowl, '', 'bowler', 0, topBowlWkts, 0, 1);

        // 4. Recalculate Points Table
        await syncPointsTableFromFixtures();

        showSuccessPopup("Match Finalized Successfully! 🏆");
    } catch (e) {
        alert("Error: " + e.message);
    }
}

function showSuccessPopup(msg) {
    const modal = document.getElementById('success-modal');
    const msgEl = document.getElementById('success-message');
    if (modal && msgEl) {
        msgEl.innerText = msg;
        modal.style.display = 'flex';
        setTimeout(() => closeSuccessModal(), 3000);
    }
}

function closeSuccessModal() {
    const modal = document.getElementById('success-modal');
    if (modal) modal.style.display = 'none';
}

async function syncPointsTableFromFixtures() {
    console.log("🔄 Recalculating Points Table (Scorer)...");
    const { data: fixtures } = await supabaseClient.from('fixtures').select('*').eq('status', 'completed');
    const { data: teams } = await supabaseClient.from('points_table').select('*');
    if (!fixtures || !teams) return;

    const stats = {};
    teams.forEach(t => { stats[t.team_name] = { played: 0, won: 0, lost: 0, points: 0, runs_scored: 0, overs_faced: 0, runs_conceded: 0, overs_bowled: 0 }; });

    fixtures.forEach(f => {
        const t1 = f.team1, t2 = f.team2;
        if (!stats[t1] || !stats[t2]) return;
        stats[t1].played++; stats[t2].played++;
        stats[t1].runs_scored += (f.t1_score || 0); stats[t1].runs_conceded += (f.t2_score || 0);
        stats[t2].runs_scored += (f.t2_score || 0); stats[t2].runs_conceded += (f.t1_score || 0);

        const getOvers = (w, o) => (w >= 10 ? 6.0 : parseFloat(o) || 6.0);
        const o1 = getOvers(f.t1_wickets, f.t1_overs), o2 = getOvers(f.t2_wickets, f.t2_overs);
        const o1_dec = Math.floor(o1) + ((o1 % 1) * 10 / 6), o2_dec = Math.floor(o2) + ((o2 % 1) * 10 / 6);

        stats[t1].overs_faced += o1_dec; stats[t1].overs_bowled += o2_dec;
        stats[t2].overs_faced += o2_dec; stats[t2].overs_bowled += o1_dec;

        if (f.winner === t1) { stats[t1].won++; stats[t1].points += 2; stats[t2].lost++; }
        else if (f.winner === t2) { stats[t2].won++; stats[t2].points += 2; stats[t1].lost++; }
        else { stats[t1].points++; stats[t2].points++; }
    });

    for (const team of Object.keys(stats)) {
        const s = stats[team];
        const forRate = s.overs_faced > 0 ? (s.runs_scored / s.overs_faced) : 0;
        const againstRate = s.overs_bowled > 0 ? (s.runs_conceded / s.overs_bowled) : 0;
        const nrr = forRate - againstRate;

        await supabaseClient.from('points_table').update({
            played: s.played, won: s.won, lost: s.lost, points: s.points, nrr: parseFloat(nrr.toFixed(3))
        }).eq('team_name', team);
    }
}

document.addEventListener('DOMContentLoaded', initScorer);
