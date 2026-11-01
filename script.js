lucide.createIcons();
let authMode = 'login';
let userLibrary = []; 
let currentSet = []; 
let spotifyPlaylist = [];
let matchedTracks = { found: [], missing: [] };
let currentCharts = [];

// ==================== CAMELOT & UTILITY ====================
const CAMELOT_MAP = {
    'am': '8A', 'amin': '8A', 'a minor': '8A', 'a': '8A',
    'em': '9A', 'emin': '9A', 'e minor': '9A', 'e': '9A',
    'bm': '10A', 'bmin': '10A', 'b minor': '10A', 'b': '10A',
    'f#m': '11A', 'f#min': '11A', 'gbm': '11A', 'gb minor': '11A',
    'c#m': '12A', 'c#min': '12A', 'dbm': '12A', 'db minor': '12A',
    'g#m': '1A', 'g#min': '1A', 'abm': '1A', 'ab minor': '1A',
    'd#m': '2A', 'd#min': '2A', 'ebm': '2A', 'eb minor': '2A',
    'a#m': '3A', 'a#min': '3A', 'bbm': '3A', 'bb minor': '3A',
    'c': '8B', 'c major': '8B', 'g': '9B', 'g major': '9B',
    'd': '10B', 'd major': '10B', 'a': '11B', 'a major': '11B',
    'e': '12B', 'e major': '12B', 'b': '1B', 'b major': '1B',
    'f#': '2B', 'f# major': '2B', 'gb': '2B', 'gb major': '2B',
    'c#': '3B', 'c# major': '3B', 'db': '3B', 'db major': '3B',
    'g#': '4B', 'g# major': '4B', 'ab': '4B', 'ab major': '4B',
    'd#': '5B', 'd# major': '5B', 'eb': '5B', 'eb major': '5B',
    'a#': '6B', 'a# major': '6B', 'bb': '6B', 'bb major': '6B',
    'f': '7B', 'f major': '7B'
};

function getCamelot(keyStr) {
    if (!keyStr) return '?';
    const k = keyStr.toString().toLowerCase().trim();
    if (/^\d+[AB]$/.test(k)) return k.toUpperCase();
    return CAMELOT_MAP[k] || '?';
}

function getEnergy(bpm) {
    if (!bpm || bpm === '?') return 5;
    const b = parseFloat(bpm);
    if (b < 110) return 3;
    if (b < 120) return 5;
    if (b < 128) return 7;
    return 9;
}

function isHarmonicMatch(key1, key2) {
    if (key1 === '?' || key2 === '?') return true;
    const n1 = parseInt(key1);
    const n2 = parseInt(key2);
    const l1 = key1.slice(-1);
    const l2 = key2.slice(-1);
    if (key1 === key2) return true;
    if (Math.abs(n1 - n2) === 1 || Math.abs(n1 - n2) === 11) return true;
    if (n1 === n2 && l1 !== l2) return true;
    return false;
}

// ==================== AUTENTICAZIONE ====================
function showMessage(text, type = 'error') {
    const msg = document.getElementById('authMessage');
    msg.classList.remove('hidden', 'bg-red-500/20', 'border-red-500', 'text-red-300', 'bg-green-500/20', 'border-green-500', 'text-green-300');
    if (type === 'error') msg.classList.add('bg-red-500/20', 'border', 'border-red-500', 'text-red-300');
    else msg.classList.add('bg-green-500/20', 'border', 'border-green-500', 'text-green-300');
    msg.innerText = text;
}
function hideMessage() { document.getElementById('authMessage').classList.add('hidden'); }

function updateAuthUI() {
    const submitBtn = document.getElementById('authSubmitBtn');
    const switchText = document.getElementById('switchText');
    const switchBtn = document.getElementById('switchModeBtn');
    const resetLink = document.getElementById('resetLink');
    const passwordField = document.getElementById('password');
    if (authMode === 'login') {
        submitBtn.innerText = 'Accedi'; switchText.innerText = 'Non hai un account?'; switchBtn.innerText = 'Registrati'; resetLink.style.display = 'block'; passwordField.required = true;
    } else if (authMode === 'register') {
        submitBtn.innerText = 'Crea Account'; switchText.innerText = 'Hai già un account?'; switchBtn.innerText = 'Accedi'; resetLink.style.display = 'none'; passwordField.required = true;
    } else if (authMode === 'reset') {
        submitBtn.innerText = 'Invia link di reset'; switchText.innerText = 'Tornato in mente?'; switchBtn.innerText = 'Accedi'; resetLink.style.display = 'none'; passwordField.required = false; passwordField.value = '';
    }
}

document.getElementById('switchModeBtn').addEventListener('click', () => { hideMessage(); authMode = authMode === 'login' ? 'register' : 'login'; updateAuthUI(); });
document.getElementById('forgotPasswordBtn').addEventListener('click', () => { hideMessage(); authMode = 'reset'; updateAuthUI(); });

document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault(); hideMessage();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const submitBtn = document.getElementById('authSubmitBtn');
    const originalText = submitBtn.innerText;
    submitBtn.disabled = true; submitBtn.innerText = 'Elaborazione...';
    try {
        if (authMode === 'login') { await supabase.signIn(email, password); showDashboard(); } 
        else if (authMode === 'register') { await supabase.signUp(email, password); showMessage('✅ Account creato!', 'success'); authMode = 'login'; updateAuthUI(); } 
        else if (authMode === 'reset') { await supabase.resetPassword(email); showMessage('📧 Email di reset inviata!', 'success'); authMode = 'login'; updateAuthUI(); }
    } catch (err) {
        let errorMsg = err.error_description || err.msg || err.message || 'Errore sconosciuto';
        if (errorMsg.toLowerCase().includes('invalid login credentials')) errorMsg = 'Email o password non corretti.';
        showMessage('❌ ' + errorMsg, 'error');
    } finally { submitBtn.disabled = false; submitBtn.innerText = originalText; }
});

function showDashboard() {
    const user = supabase.getUser();
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('dashboardScreen').classList.remove('hidden');
    if (user && user.email) document.getElementById('userEmail').innerText = user.email;
    loadSavedLibrary();
}
function logout() { supabase.signOut(); document.getElementById('dashboardScreen').classList.add('hidden'); document.getElementById('loginScreen').classList.remove('hidden'); hideMessage(); }
if (supabase.isLoggedIn()) showDashboard(); else updateAuthUI();

// ==================== IMPORT LIBRERIA ====================
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
['dragenter', 'dragover'].forEach(eventName => { dropZone.addEventListener(eventName, (e) => { e.preventDefault(); dropZone.classList.add('drag-active'); }); });
['dragleave', 'drop'].forEach(eventName => { dropZone.addEventListener(eventName, (e) => { e.preventDefault(); dropZone.classList.remove('drag-active'); }); });
dropZone.addEventListener('drop', (e) => { const files = e.dataTransfer.files; if (files.length) handleFile(files[0]); });
fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFile(e.target.files[0]); });

function handleFile(file) {
    document.getElementById('dropText').innerText = `Analisi di ${file.name} in corso...`;
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        let tracks = [];
        if (file.name.endsWith('.xml')) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(content, "text/xml");
            const trackNodes = xmlDoc.getElementsByTagName("TRACK");
            tracks = Array.from(trackNodes).map(node => ({
                artist: node.getAttribute("Artist") || "Unknown",
                title: node.getAttribute("Name") || "Unknown",
                bpm: node.getAttribute("BPM") || "?",
                key: getCamelot(node.getAttribute("Key") || "?"),
                energy: getEnergy(node.getAttribute("BPM"))
            }));
        } else if (file.name.endsWith('.m3u8') || file.name.endsWith('.m3u')) {
            const lines = content.split(/\r?\n/);
            let currentTitle = "";
            for (let line of lines) {
                line = line.trim();
                if (line.startsWith("#EXTINF:")) {
                    const commaIndex = line.indexOf(",");
                    if (commaIndex > -1) currentTitle = line.substring(commaIndex + 1).trim();
                } else if (line && !line.startsWith("#") && currentTitle !== "") {
                    const parts = currentTitle.split(' - ');
                    tracks.push({
                        artist: parts.length >= 2 ? parts[0].trim() : "Unknown",
                        title: parts.length >= 2 ? parts.slice(1).join(' - ').trim() : currentTitle,
                        bpm: "?", key: "?", energy: 5
                    });
                    currentTitle = "";
                }
            }
        } else { alert('Formato non supportato. Usa .m3u8 (Engine DJ) o .xml (Rekordbox).'); return; }
        userLibrary = tracks;
        document.getElementById('dropText').innerText = 'Trascina qui il file o clicca per selezionare';
        document.getElementById('resultArea').classList.remove('hidden');
        document.getElementById('resultText').innerText = `Trovate ${tracks.length} tracce. Pronte per il Set Builder!`;
        renderLibraryForSelection();
        saveLibraryToCloud();
    };
    reader.readAsText(file);
}

function renderLibraryForSelection() {
    const list = document.getElementById('setBuilderList');
    if (userLibrary.length === 0) return;
    const preview = userLibrary.slice(0, 30);
    list.innerHTML = `
        <div class="mb-4 p-3 bg-aura-gold/10 border border-aura-gold/30 rounded-lg flex justify-between items-center">
            <span class="text-aura-gold font-semibold text-sm">Seleziona le tracce da includere nel set:</span>
            <div class="flex gap-2">
                <button onclick="selectAllTracks(true)" class="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-white">Seleziona Tutte</button>
                <button onclick="selectAllTracks(false)" class="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-white">Deseleziona</button>
            </div>
        </div>
        ${preview.map((t, i) => `
            <label class="set-track cursor-pointer">
                <input type="checkbox" class="track-selector w-5 h-5 accent-aura-gold" data-index="${i}" checked>
                <div class="flex-1 min-w-0">
                    <div class="font-semibold text-white truncate">${t.artist} - ${t.title}</div>
                    <div class="flex gap-3 text-xs text-slate-400 mt-1">
                        <span class="camelot-badge">${t.key}</span>
                        <span>${t.bpm} BPM</span>
                        <span>Energia: ${t.energy}/10</span>
                    </div>
                </div>
            </label>
        `).join('')}
        ${userLibrary.length > 30 ? `<p class="text-center text-slate-500 text-sm mt-2">...e altre ${userLibrary.length - 30} tracce</p>` : ''}
    `;
}

function selectAllTracks(checked) {
    document.querySelectorAll('.track-selector').forEach(cb => cb.checked = checked);
}

// ==================== AURA SET BUILDER ENGINE ====================
document.getElementById('buildSetBtn').addEventListener('click', () => {
    if (userLibrary.length === 0) { alert('Carica prima una libreria!'); return; }
    const checkboxes = document.querySelectorAll('.track-selector:checked');
    const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));
    let pool = selectedIndices.map(i => userLibrary[i]);
    if (pool.length < 2) { alert('Seleziona almeno 2 tracce per costruire un set.'); return; }

    const shape = document.getElementById('nightShape').value;
    let targetEnergies = [];
    if (shape === 'warmup') targetEnergies = pool.map((_, i) => 3 + (i / pool.length) * 2);
    else if (shape === 'peak') targetEnergies = pool.map((_, i) => { const pos = i / pool.length; return pos < 0.5 ? 7 + (pos * 2 * 2) : 9 - ((pos - 0.5) * 2 * 2); });
    else if (shape === 'closing') targetEnergies = pool.map((_, i) => 6 - (i / pool.length) * 2);
    else targetEnergies = pool.map((_, i) => { const pos = i / pool.length; if (pos < 0.25) return 3 + (pos * 4 * 2); if (pos < 0.75) return 5 + ((pos - 0.25) * 4 * 1.6); return 9 - ((pos - 0.75) * 4 * 2); });

    currentSet = [];
    let available = [...pool];
    available.sort((a, b) => a.energy - b.energy);
    currentSet.push(available.shift());

    while (available.length > 0) {
        const lastTrack = currentSet[currentSet.length - 1];
        const targetIdx = currentSet.length;
        const targetEnergy = targetEnergies[targetIdx] || 5;
        let bestScore = -999;
        let bestTrackIdx = 0;
        for (let i = 0; i < available.length; i++) {
            const candidate = available[i];
            let score = 0;
            if (isHarmonicMatch(lastTrack.key, candidate.key)) score += 50;
            const bpmDiff = Math.abs(parseFloat(candidate.bpm || 0) - parseFloat(lastTrack.bpm || 0));
            if (bpmDiff <= 3) score += 30; else if (bpmDiff <= 6) score += 15; else score -= bpmDiff;
            const energyDiff = Math.abs(candidate.energy - targetEnergy);
            score -= (energyDiff * 5);
            if (score > bestScore) { bestScore = score; bestTrackIdx = i; }
        }
        currentSet.push(available.splice(bestTrackIdx, 1)[0]);
    }
    renderCurrentSet();
});

function renderCurrentSet() {
    const list = document.getElementById('setBuilderList');
    list.innerHTML = currentSet.map((t, i) => {
        if (i === 0) return renderSetTrack(t, i, null);
        const prev = currentSet[i - 1];
        const bpmDiff = Math.abs(parseFloat(t.bpm || 0) - parseFloat(prev.bpm || 0));
        const isHarmonic = isHarmonicMatch(prev.key, t.key);
        let status = 'success'; let icon = 'check';
        if (!isHarmonic || bpmDiff > 8) { status = 'danger'; icon = 'alert-triangle'; }
        else if (bpmDiff > 4) { status = 'warning'; icon = 'minus'; }
        return renderSetTrack(t, i, { status, icon, bpmDiff, isHarmonic });
    }).join('');
    lucide.createIcons();
}

function renderSetTrack(t, index, transition) {
    let transitionHtml = ''; let borderClass = 'success';
    if (index > 0 && transition) {
        borderClass = transition.status;
        transitionHtml = `<div class="transition-icon ${transition.status}" title="Diff BPM: ${transition.bpmDiff.toFixed(1)} | Armonia: ${transition.isHarmonic ? 'OK' : 'NO'}"><i data-lucide="${transition.icon}" class="w-4 h-4"></i></div>`;
    } else { transitionHtml = `<div class="w-6"></div>`; }
    return `
        <div class="set-track ${borderClass}">
            ${transitionHtml}
            <div class="camelot-badge">${t.key}</div>
            <div class="flex-1 min-w-0">
                <div class="font-semibold text-white truncate">${index + 1}. ${t.artist} - ${t.title}</div>
                <div class="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span>${t.bpm} BPM</span>
                    <div class="flex items-center gap-1"><span>E:</span><div class="energy-bar"><div class="energy-fill" style="width: ${t.energy * 10}%"></div></div></div>
                </div>
            </div>
        </div>
    `;
}

document.getElementById('fixTransitionsBtn').addEventListener('click', () => {
    if (currentSet.length < 2) { alert('Costruisci prima un set!'); return; }
    let fixed = 0;
    for (let i = 1; i < currentSet.length; i++) {
        const prev = currentSet[i - 1]; const curr = currentSet[i];
        const bpmDiff = Math.abs(parseFloat(curr.bpm || 0) - parseFloat(prev.bpm || 0));
        const isHarmonic = isHarmonicMatch(prev.key, curr.key);
        if (!isHarmonic || bpmDiff > 8) {
            const unused = userLibrary.filter(u => !currentSet.includes(u));
            let bestSwap = null; let bestScore = -999;
            for (let u of unused) {
                let score = 0;
                if (isHarmonicMatch(prev.key, u.key)) score += 50;
                if (isHarmonicMatch(u.key, currentSet[i + 1]?.key || u.key)) score += 50;
                const uBpmDiff1 = Math.abs(parseFloat(u.bpm || 0) - parseFloat(prev.bpm || 0));
                const uBpmDiff2 = Math.abs(parseFloat(u.bpm || 0) - parseFloat(currentSet[i + 1]?.bpm || u.bpm || 0));
                if (uBpmDiff1 < 5) score += 20; if (uBpmDiff2 < 5) score += 20;
                if (score > bestScore) { bestScore = score; bestSwap = u; }
            }
            if (bestSwap && bestScore > 60) { currentSet[i] = bestSwap; fixed++; }
        }
    }
    if (fixed > 0) { alert(`🛠 ${fixed} transizioni critiche risolte!`); renderCurrentSet(); } 
    else { alert('✅ Nessuna transizione critica trovata o nessuna alternativa migliore.'); }
});

document.getElementById('exportSetBtn').addEventListener('click', () => {
    if (currentSet.length === 0) { alert('Costruisci prima un set!'); return; }
    let m3u8 = '#EXTM3U\n# PLAYLIST: AURA Set Builder Export (Engine DJ Compatible)\n# GENERATED: ' + new Date().toISOString().split('T')[0] + '\n\n';
    currentSet.forEach(t => {
        m3u8 += `# BPM: ${t.bpm} | KEY: ${t.key}\n#EXTINF:210,${t.artist} - ${t.title}\n${t.artist} - ${t.title}.mp3\n\n`;
    });
    downloadM3U8(m3u8, 'AURA_EngineDJ_Set');
});

// ==================== SALVATAGGIO CLOUD ====================
async function saveLibraryToCloud() {
    if (!supabase.isLoggedIn() || userLibrary.length === 0) return;
    try {
        await supabase.saveLibrary(userLibrary, 'Libreria Engine DJ');
        const n = document.createElement('div');
        n.className = 'fixed top-20 right-4 bg-aura-gold/20 border border-aura-gold text-aura-gold px-4 py-3 rounded-lg shadow-lg z-50';
        n.innerHTML = `<div class="flex items-center gap-2"><i data-lucide="check-circle" class="w-5 h-5"></i><span>Libreria salvata nel cloud</span></div>`;
        document.body.appendChild(n); lucide.createIcons(); setTimeout(() => n.remove(), 3000);
    } catch (err) { console.error('Errore salvataggio:', err); }
}

async function loadSavedLibrary() {
    if (!supabase.isLoggedIn()) return;
    try {
        const saved = await supabase.loadLibrary();
        if (saved && saved.tracks && saved.tracks.length > 0) {
            userLibrary = saved.tracks;
            const n = document.createElement('div');
            n.className = 'fixed top-20 right-4 bg-green-500/20 border border-green-500 text-green-300 px-4 py-3 rounded-lg shadow-lg z-50';
            n.innerHTML = `<div class="flex items-center gap-2"><i data-lucide="cloud" class="w-5 h-5"></i><span>Libreria caricata: <b>${userLibrary.length} tracce</b></span></div>`;
            document.body.appendChild(n); lucide.createIcons(); setTimeout(() => n.remove(), 4000);
            renderLibraryForSelection();
        }
    } catch (err) { console.error('Errore caricamento:', err); }
}

// ==================== TRACK MATCHER ====================
const matcherDropZone = document.getElementById('matcherDropZone');
const matcherFileInput = document.getElementById('matcherFileInput');
['dragenter', 'dragover'].forEach(eventName => { matcherDropZone.addEventListener(eventName, (e) => { e.preventDefault(); matcherDropZone.classList.add('drag-active'); }); });
['dragleave', 'drop'].forEach(eventName => { matcherDropZone.addEventListener(eventName, (e) => { e.preventDefault(); matcherDropZone.classList.remove('drag-active'); }); });
matcherDropZone.addEventListener('drop', (e) => { const files = e.dataTransfer.files; if (files.length) handleMatcherFile(files[0]); });
matcherFileInput.addEventListener('change', (e) => { if (e.target.files.length) handleMatcherFile(e.target.files[0]); });

function handleMatcherFile(file) {
    document.getElementById('matcherDropText').innerText = `Analisi di ${file.name} in corso...`;
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        spotifyPlaylist = parseSpotifyExport(content, file.name);
        if (spotifyPlaylist.length === 0) { alert('Nessuna traccia trovata.'); document.getElementById('matcherDropText').innerText = 'Carica la playlist Spotify esportata'; return; }
        performMatching();
    };
    reader.readAsText(file);
}

function parseSpotifyExport(content, filename) {
    const tracks = [];
    if (filename.endsWith('.csv')) {
        const lines = content.split(/\r?\n/);
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
            if (cols.length >= 2 && cols[0] && cols[1]) tracks.push({ artist: cols[0].toLowerCase(), title: cols[1].toLowerCase(), original: `${cols[0]} - ${cols[1]}` });
        }
    } else {
        const lines = content.split(/\r?\n/);
        for (let line of lines) {
            line = line.trim();
            if (line && line.includes(' - ')) {
                const parts = line.split(' - ');
                if (parts.length >= 2) tracks.push({ artist: parts[0].toLowerCase(), title: parts.slice(1).join(' - ').toLowerCase(), original: line });
            }
        }
    }
    return tracks;
}

function performMatching() {
    if (userLibrary.length === 0) { alert('⚠️ Prima carica la tua libreria Engine DJ/Rekordbox nella sezione 1.'); document.getElementById('matcherDropText').innerText = 'Carica la playlist Spotify esportata'; return; }
    matchedTracks = { found: [], missing: [] };
    for (let spotifyTrack of spotifyPlaylist) {
        const found = userLibrary.some(libTrack => {
            const artistMatch = libTrack.artist.toLowerCase().includes(spotifyTrack.artist) || spotifyTrack.artist.includes(libTrack.artist.toLowerCase());
            const titleMatch = libTrack.title.toLowerCase().includes(spotifyTrack.title) || spotifyTrack.title.includes(libTrack.title.toLowerCase());
            return artistMatch && titleMatch;
        });
        if (found) matchedTracks.found.push(spotifyTrack); else matchedTracks.missing.push(spotifyTrack);
    }
    renderMatcherResults();
}

function renderMatcherResults() {
    document.getElementById('matcherDropText').innerText = 'Carica la playlist Spotify esportata';
    document.getElementById('matcherResults').classList.remove('hidden');
    document.getElementById('matcherTotal').innerText = spotifyPlaylist.length;
    document.getElementById('matcherFound').innerText = matchedTracks.found.length;
    document.getElementById('matcherMissing').innerText = matchedTracks.missing.length;
    document.getElementById('foundCount').innerText = matchedTracks.found.length;
    document.getElementById('missingCount').innerText = matchedTracks.missing.length;
    renderFoundList(); renderMissingList();
}

function renderFoundList() {
    const list = document.getElementById('foundList');
    if (matchedTracks.found.length === 0) { list.innerHTML = '<p class="text-center text-slate-500 py-8">Nessuna traccia trovata.</p>'; return; }
    list.innerHTML = matchedTracks.found.map(track => `<div class="matcher-track found"><i data-lucide="check-circle" class="w-5 h-5 text-green-400"></i><div class="matcher-track-info"><div class="matcher-track-title">${track.original}</div><div class="matcher-track-artist">✅ Presente nel database</div></div></div>`).join('');
    lucide.createIcons();
}

function renderMissingList() {
    const list = document.getElementById('missingList');
    if (matchedTracks.missing.length === 0) { list.innerHTML = '<p class="text-center text-slate-500 py-8">🎉 Hai già tutte le tracce!</p>'; return; }
    list.innerHTML = matchedTracks.missing.map(track => `
        <div class="matcher-track missing">
            <i data-lucide="alert-circle" class="w-5 h-5 text-red-400"></i>
            <div class="matcher-track-info"><div class="matcher-track-title">${track.original}</div><div class="matcher-track-artist">❌ Mancante</div></div>
            <button class="matcher-search-btn spotify" onclick="window.open('https://open.spotify.com/search/${encodeURIComponent(track.original)}', '_blank')">Spotify</button>
            <button class="matcher-search-btn tidal" onclick="window.open('https://tidal.com/search?q=${encodeURIComponent(track.original)}', '_blank')">Tidal</button>
        </div>
    `).join('');
    lucide.createIcons();
}

document.getElementById('showFoundBtn').addEventListener('click', () => {
    document.getElementById('foundList').classList.remove('hidden'); document.getElementById('missingList').classList.add('hidden');
    document.getElementById('showFoundBtn').classList.add('active'); document.getElementById('showMissingBtn').classList.remove('active');
});
document.getElementById('showMissingBtn').addEventListener('click', () => {
    document.getElementById('foundList').classList.add('hidden'); document.getElementById('missingList').classList.remove('hidden');
    document.getElementById('showMissingBtn').classList.add('active'); document.getElementById('showFoundBtn').classList.remove('active');
});

document.getElementById('exportMissingBtn').addEventListener('click', () => {
    if (matchedTracks.missing.length === 0) { alert('Nessuna traccia mancante.'); return; }
    let m3u8 = '#EXTM3U\n# PLAYLIST: AURA - Tracce mancanti (Da acquistare per Engine DJ)\n';
    matchedTracks.missing.forEach(track => {
        m3u8 += `#EXTINF:210,${track.original}\n# SPOTIFY: https://open.spotify.com/search/${encodeURIComponent(track.original)}\n# TIDAL: https://tidal.com/search?q=${encodeURIComponent(track.original)}\n${track.original}.mp3\n\n`;
    });
    downloadM3U8(m3u8, 'AURA_Tracce_Mancanti');
});

function downloadM3U8(content, filename) {
    const blob = new Blob([content], { type: 'audio/x-mpegurl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}_${new Date().toISOString().split('T')[0]}.m3u8`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ==================== GLOBAL CHARTS ====================
document.getElementById('loadChartsBtn').addEventListener('click', async () => {
    const countryId = document.getElementById('countrySelect').value;
    const loading = document.getElementById('chartsLoading');
    const list = document.getElementById('chartsList');
    const actions = document.getElementById('chartsActions');
    loading.classList.remove('hidden'); list.innerHTML = ''; actions.classList.add('hidden');
    try {
        const url = countryId === '0' ? 'https://api.deezer.com/chart/0/tracks?limit=50' : `https://api.deezer.com/chart/${countryId}/tracks?limit=50`;
        const response = await fetch(url);
        const data = await response.json();
        currentCharts = data.data.map((track, idx) => ({
            rank: idx + 1, title: track.title, artist: track.artist.name, cover: track.album.cover_medium,
            tidalQuery: `${track.artist.name} ${track.title}`.replace(/[^a-zA-Z0-9\s]/g, '')
        }));
        list.innerHTML = currentCharts.map(track => `
            <div class="chart-track">
                <span class="chart-rank">#${track.rank}</span>
                <img src="${track.cover}" class="chart-cover">
                <div class="chart-info"><div class="chart-title">${track.title}</div><div class="chart-artist">${track.artist}</div></div>
            </div>
        `).join('');
        actions.classList.remove('hidden');
    } catch (err) { list.innerHTML = `<p class="text-center text-red-400 py-8">Errore nel caricamento</p>`; } 
    finally { loading.classList.add('hidden'); }
});

document.getElementById('exportM3U8Btn').addEventListener('click', () => {
    if (currentCharts.length === 0) return;
    let m3u8 = '#EXTM3U\n# PLAYLIST: AURA - Global Charts (Engine DJ Compatible)\n';
    currentCharts.forEach(track => {
        m3u8 += `#EXTINF:210,${track.artist} - ${track.title}\n# TIDAL: https://tidal.com/search?q=${encodeURIComponent(track.tidalQuery)}\n${track.artist} - ${track.title}.mp3\n\n`;
    });
    downloadM3U8(m3u8, 'AURA_Global_Charts');
});
