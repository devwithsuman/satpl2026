// Helper for PDF to Image
async function renderPdfPhoto(url, imgElement) {
    try {
        if (typeof pdfjsLib === 'undefined') {
            console.warn("pdf.js not loaded, skipping PDF render");
            return;
        }
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2.5 });
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

// Function to populate card data
async function populateCardData(data) {
    if (!data) return;

    // Front Side
    document.getElementById('player-name').innerText = data.player_name || 'PLAYER NAME';
    document.getElementById('reg-id').innerText = data.registration_no || 'TBD';
    document.getElementById('player-mobile').innerText = data.mobile_number || 'N/A';

    // Role Logic
    let role = "Allrounder";
    if (data.batting !== 'no' && data.bowling === 'no') role = "Batsman";
    else if (data.batting === 'no' && data.bowling !== 'no') role = "Bowler";
    if (data.wicket_keeper === 'yes' || data.wicket_keeper === true) role += " & WK";
    document.getElementById('player-role').innerText = role;

    // Photo
    const photoImg = document.getElementById('player-photo');
    if (data.photo_url) {
        if (data.photo_url.toLowerCase().endsWith('.pdf')) {
            await renderPdfPhoto(data.photo_url, photoImg);
        } else {
            photoImg.src = data.photo_url;
        }
    }

    // QR Code for Back Side
    const currentOrigin = window.location.origin;
    const verifyUrl = `${currentOrigin}/success.html?reg_no=${data.registration_no}&auto_download=true`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verifyUrl)}&bgcolor=ffffff&color=001A33`;
    document.getElementById('player-qr').src = qrUrl;

    // Standardize Logo
    document.querySelectorAll('.id-logo-wrap img').forEach(img => {
        if (typeof LOGO_BASE64 !== 'undefined') {
            img.src = LOGO_BASE64;
        } else {
            img.src = 'IMG.svg';
        }
    });
}

// Check for URL parameters if loaded standalone
const cardParams = new URLSearchParams(window.location.search);
const cardToken = cardParams.get('id'); // Use 'id' for token

if (cardToken && typeof supabaseClient !== 'undefined') {
    (async () => {
        const { data, error } = await supabaseClient
            .from('player_registrations')
            .select('*')
            .eq('token', cardToken) // Fetch by Token
            .single();

        if (data) populateCardData(data);
        else {
            // Fallback: try by reg_no if it's old link
            const oldRegNo = cardParams.get('reg_no');
            if (oldRegNo) {
                const { data: oldData } = await supabaseClient
                    .from('player_registrations')
                    .select('*')
                    .eq('registration_no', oldRegNo)
                    .single();
                if (oldData) populateCardData(oldData);
            }
        }
    })();
}
