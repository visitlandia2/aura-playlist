lucide.createIcons();
let authMode = 'login';
let userLibrary = []; 
let playlistStructure = {};
let selectedTracks = new Set();
let spotifyPlaylist = [];
let matchedTracks = { found: [], uncertain: [], missing: [] };
let currentCharts = [];

// ==================== CAMELOT ====================
const CAMELOT_MAP = {
    'am': '8A', 'a': '8A', 'em': '9A', 'e': '9A', 'bm': '10A', 'b': '10A',
    'f#m': '11A', 'gbm': '11A', 'c#m': '12A', 'dbm': '12A',
    'g#m': '1A', 'abm': '1A', 'd#m': '2A', 'ebm': '2A', 'a#m': '3A', 'bbm': '3A',
    'c': '8B', 'g': '9B', 'd': '10B', 'a': '11B', 'e': '12B', 'b': '1B',
    'f#': '2B', 'gb': '2B', 'c#': '3B', 'db': '3B', 'g#': '4B', 'ab': '4B',
    'd#': '5B', 'eb': '5B', 'a#': '6B', 'bb': '6B', 'f': '7B'
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

// ==================== NORMALIZZAZIONE SUPER FLESSIBILE ====================
const NOISE_WORDS = [
    'remaster', 'remastered', '2019', '2020', '2021', '2022', '2023', '2024', '2025',
    'official video', 'official audio', 'lyric video', 'audio', 'video',
    'feat', 'ft', 'featuring', 'vs', 'x',
    'remix', 'extended', 'radio edit', 'original mix', 'club mix', 'instrumental',
    'acoustic', 'live', 'version', 'edit', 'mix', 'clean', 'explicit',
    'from', 'soundtrack', 'album version', 'single version',
    'hq', 'hd', '4k', 'official'
];

function normalizeText(text, strictMode = false) {
    if (!text) return '';
    let normalized = text.toString().toLowerCase();
    
    // Rimuovi caratteri speciali
    normalized = normalized.replace(/[~"'`´^]/g, ' ');
    normalized = normalized.replace(/\s*-\s*/g, ' ');
    normalized = normalized.replace(/\s*\(\s*/g, ' ');
    normalized = normalized.replace(/\s*\)\s*/g, ' ');
    normalized = normalized.replace(/\s*\[\s*/g, ' ');
    normalized = normalized.replace(/\s*\]\s*/g, ' ');
    
    // Rimuovi feat, ft, featuring, vs, x
    normalized = normalized.replace(/\s*(feat\.?|ft\.?|featuring|vs\.?| x )\s+[^,;]+/gi, ' ');
    
    if (!strictMode) {
        for (let word of NOISE_WORDS) {
            const regex = new RegExp('\\b' + word + '\\b', 'gi');
            normalized = normalized.replace(regex, ' ');
        }
    }
    
    normalized = normalized.replace(/[^\w\s]/g, ' ');
    normalized = normalized.replace(/\s+/g, ' ').trim();
    
    return normalized;
}

function calculateMatchScore(spotifyTrack, libTrack) {
    const spotifyArtist = normalizeText(spotifyTrack.artist, true);
    const libArtist = normalizeText(libTrack.artist, true);
    
    const spotifyTitle = normalizeText(spotifyTrack.title, false);
    const libTitle = normalizeText(libTrack.title, false);
    
    const artistSimilarity = stringSimilarity(spotifyArtist, libArtist);
    const titleSimilarity = stringSimilarity(spotifyTitle, libTitle);
    
    let artistWeight, titleWeight;
    
    if (artistSimilarity >= 90) {
        artistWeight = 0.80;
        titleWeight = 0.20;
    } else if (artistSimilarity >= 70) {
        artistWeight = 0.60;
        titleWeight = 0.40;
    } else {
        artistWeight = 0.50;
        titleWeight = 0.50;
    }
    
    const totalScore = (artistSimilarity * artistWeight) + (titleSimilarity * titleWeight);
    
    return {
        total: totalScore,
        artist: artistSimilarity,
        title: titleSimilarity
    };
}

function stringSimilarity(str1, str2) {
    const s1 = str1;
    const s2 = str2;
    
    if (s1 === s2) return 100;
    if (s1.length === 0 || s2.length === 0) return 0;
    
    if (s1.includes(s2) || s2.includes(s1)) {
        const shorter = Math.min(s1.length, s2.length);
        const longer = Math.max(s1.length, s2.length);
        return (shorter / longer) * 100;
    }
    
    const words1 = s1.split(' ').filter(w => w.length > 1);
    const words2 = s2.split(' ').filter(w => w.length > 1);
    let commonWords = 0;
    
    for (let w1 of words1) {
        for (let w2 of words2) {
            if (w1 === w2) { commonWords++; break; }
        }
    }
    
    const maxWords = Math.max(words1.length, words2.length);
    if (maxWords === 0) return 0;
    return (commonWords / maxWords) * 100;
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
        submitBtn.innerText = 'Invia link'; switchText.innerText = 'Tornato in mente?'; switchBtn.innerText = 'Accedi'; resetLink.style.display = 'none'; passwordField.required = false; passwordField.value = '';
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
        else if (authMode === 'reset') { await supabase.resetPassword(email); showMessage('📧 Email inviata!', 'success'); authMode = 'login'; updateAuthUI(); }
    } catch (err) {
        let errorMsg = err.error_description || err.msg || err.message || 'Errore';
        if (errorMsg.toLowerCase().includes('invalid login credentials')) errorMsg = 'Email o password errati.';
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
        let playlists = {};
        
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
            playlists = { 'Collection': tracks };
        } else if (file.name.endsWith('.m3u8') || file.name.endsWith('.m3u')) {
            const lines = content.split(/\r?\n/);
            let currentPlaylist = 'Collection';
            let currentTitle = "";
            let currentArtist = "";
            playlists[currentPlaylist] = [];
            
            for (let line of lines) {
                line = line.trim();
                if (line.startsWith('#PLAYLIST:') || line.startsWith('#Playlist:')) {
                    currentPlaylist = line.substring(10).trim();
                    if (!playlists[currentPlaylist]) playlists[currentPlaylist] = [];
                } else if (line.startsWith("#EXTINF:")) {
                    const commaIndex = line.indexOf(",");
                    if (commaIndex > -1) {
                        const metadata = line.substring(commaIndex + 1).trim();
                        const parts = metadata.split(' - ');
                        if (parts.length >= 2) {
                            currentArtist = parts[0].trim();
                            currentTitle = parts.slice(1).join(' - ').trim();
                        } else {
                            currentArtist = "Unknown";
                            currentTitle = metadata;
                        }
                    }
                } else if (line && !line.startsWith("#") && currentTitle !== "") {
                    const track = { artist: currentArtist, title: currentTitle, bpm: "?", key: "?", energy: 5, playlist: currentPlaylist };
                    tracks.push(track);
                    if (!playlists[currentPlaylist]) playlists[currentPlaylist] = [];
                    playlists[currentPlaylist].push(track);
                    currentTitle = ""; currentArtist = "";
                }
            }
        } else { alert('Formato non supportato.'); return; }
        
        userLibrary = tracks;
        playlistStructure = playlists;
        document.getElementById('dropText').innerText = 'Trascina qui il file';
        document.getElementById('resultArea').classList.remove('hidden');
        document.getElementById('resultText').innerText = `Trovate ${tracks.length} tracce in ${Object.keys(playlists).length} playlist.`;
        renderPlaylistTree();
        saveLibraryToCloud();
    };
    reader.readAsText(file);
}

function renderPlaylistTree() {
    const tree = document.getElementById('playlistTree');
    if (Object.keys(playlistStructure).length === 0) {
        tree.innerHTML = '<p class="text-center text-slate-500 py-8">Nessuna playlist.</p>';
        return;
    }
    let html = '<div class="playlist-tree">';
    for (let [playlistName, tracks] of Object.entries(playlistStructure)) {
        html += `<div class="playlist-folder">
            <div class="folder-header" onclick="toggleFolder(this)">
                <span class="folder-icon">📁</span>
                <span class="folder-name">${playlistName}</span>
                <span class="folder-count">${tracks.length} tracce</span>
            </div>
            <div class="folder-children">`;
        tracks.forEach((track, idx) => {
            const trackId = `${playlistName}-${idx}`;
            html += `<div class="track-item">
                <input type="checkbox" class="track-checkbox" data-id="${trackId}" onchange="updateSelectedCount()">
                <div class="track-info">
                    <div class="track-title">${track.artist} - ${track.title}</div>
                    <div class="track-meta">${track.key} | ${track.bpm} BPM</div>
                </div>
            </div>`;
        });
        html += `</div></div>`;
    }
    html += '</div>';
    tree.innerHTML = html;
}

function toggleFolder(header) {
    const children = header.nextElementSibling;
    const icon = header.querySelector('.folder-icon');
    if (children.classList.contains('expanded')) {
        children.classList.remove('expanded');
        header.classList.remove('expanded');
        icon.textContent = '📁';
    } else {
        children.classList.add('expanded');
        header.classList.add('expanded');
        icon.textContent = '📂';
    }
}

function updateSelectedCount() {
    const checkboxes = document.querySelectorAll('.track-checkbox:checked');
    selectedTracks.clear();
    checkboxes.forEach(cb => selectedTracks.add(cb.dataset.id));
    document.getElementById('selectedTracksCount').innerText = selectedTracks.size;
}

document.getElementById('expandAllBtn').addEventListener('click', () => {
    document.querySelectorAll('.folder-children').forEach(el => el.classList.add('expanded'));
    document.querySelectorAll('.folder-header').forEach(el => { el.classList.add('expanded'); el.querySelector('.folder-icon').textContent = '📂'; });
});
document.getElementById('collapseAllBtn').addEventListener('click', () => {
    document.querySelectorAll('.folder-children').forEach(el => el.classList.remove('expanded'));
    document.querySelectorAll('.folder-header').forEach(el => { el.classList.remove('expanded'); el.querySelector('.folder-icon').textContent = '📁'; });
});
document.getElementById('selectAllPlaylistsBtn').addEventListener('click', () => {
    document.querySelectorAll('.track-checkbox').forEach(cb => cb.checked = true);
    updateSelectedCount();
});

// ==================== CLOUD ====================
async function saveLibraryToCloud() {
    if (!supabase.isLoggedIn() || userLibrary.length === 0) return;
    try {
        await supabase.saveLibrary(userLibrary, 'Libreria Engine DJ');
        const n = document.createElement('div');
        n.className = 'fixed top-20 right-4 bg-aura-gold/20 border border-aura-gold text-aura-gold px-4 py-3 rounded-lg shadow-lg z-50';
        n.innerHTML = `<div class="flex items-center gap-2"><i data-lucide="check-circle" class="w-5 h-5"></i><span>Salvata nel cloud</span></div>`;
        document.body.appendChild(n); lucide.createIcons(); setTimeout(() => n.remove(), 3000);
    } catch (err) { console.error(err); }
}

async function loadSavedLibrary() {
    if (!supabase.isLoggedIn()) return;
    try {
        const saved = await supabase.loadLibrary();
        if (saved && saved.tracks && saved.tracks.length > 0) {
            userLibrary = saved.tracks;
            playlistStructure = { 'Collection': userLibrary };
            const n = document.createElement('div');
            n.className = 'fixed top-20 right-4 bg-green-500/20 border border-green-500 text-green-300 px-4 py-3 rounded-lg shadow-lg z-50';
            n.innerHTML = `<div class="flex items-center gap-2"><i data-lucide="cloud" class="w-5 h-5"></i><span>Caricata: <b>${userLibrary.length} tracce</b></span></div>`;
            document.body.appendChild(n); lucide.createIcons(); setTimeout(() => n.remove(), 4000);
            renderPlaylistTree();
        }
    } catch (err) { console.error(err); }
}

// ==================== TRACK MATCHER ====================
const matcherDropZone = document.getElementById('matcherDropZone');
const matcherFileInput = document.getElementById('matcherFileInput');
['dragenter', 'dragover'].forEach(eventName => { matcherDropZone.addEventListener(eventName, (e) => { e.preventDefault(); matcherDropZone.classList.add('drag-active'); }); });
['dragleave', 'drop'].forEach(eventName => { matcherDropZone.addEventListener(eventName, (e) => { e.preventDefault(); matcherDropZone.classList.remove('drag-active'); }); });
matcherDropZone.addEventListener('drop', (e) => { const files = e.dataTransfer.files; if (files.length) handleMatcherFile(files[0]); });
matcherFileInput.addEventListener('change', (e) => { if (e.target.files.length) handleMatcherFile(e.target.files[0]); });

function handleMatcherFile(file) {
    document.getElementById('matcherDropText').innerText = `Analisi di ${file.name}...`;
    const reader = new FileReader();
    reader.onload = function(e) {
        spotifyPlaylist = parseSpotifyExport(e.target.result, file.name);
        if (spotifyPlaylist.length === 0) { alert('Nessuna traccia trovata.'); document.getElementById('matcherDropText').innerText = 'Trascina qui il file'; return; }
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
            if (cols.length >= 2 && cols[0] && cols[1]) tracks.push({ artist: cols[0], title: cols[1], original: `${cols[0]} - ${cols[1]}` });
        }
    } else {
        const lines = content.split(/\r?\n/);
        for (let line of lines) {
            line = line.trim();
            if (line && line.includes(' - ')) {
                const parts = line.split(' - ');
                if (parts.length >= 2) tracks.push({ artist: parts[0], title: parts.slice(1).join(' - '), original: line });
            }
        }
    }
    return tracks;
}

function performMatching() {
    if (userLibrary.length === 0) { alert('⚠️ Prima carica la libreria!'); return; }
    
    matchedTracks = { found: [], uncertain: [], missing: [] };
    
    for (let sp of spotifyPlaylist) {
        let bestMatch = null;
        let bestScore = { total: 0, artist: 0, title: 0 };
        
        for (let lib of userLibrary) {
            const score = calculateMatchScore(sp, lib);
            if (score.total > bestScore.total) {
                bestScore = score;
                bestMatch = lib;
            }
        }
        
        // LOGICA:
        // Match sicuro: autore >= 85% (indipendentemente dal titolo)
        // Match possibile: autore >= 70% E totale >= 50%
        // Mancante: tutto il resto
        
        if (bestScore.artist >= 85) {
            matchedTracks.found.push({ ...sp, match: bestMatch, score: bestScore });
        } else if (bestScore.artist >= 70 && bestScore.total >= 50) {
            matchedTracks.uncertain.push({ ...sp, match: bestMatch, score: bestScore });
        } else {
            matchedTracks.missing.push(sp);
        }
    }
    
    renderMatcherResults();
}

function renderMatcherResults() {
    document.getElementById('matcherDropText').innerText = 'Trascina qui il file';
    document.getElementById('matcherResults').classList.remove('hidden');
    document.getElementById('matcherTotal').innerText = spotifyPlaylist.length;
    document.getElementById('matcherFound').innerText = matchedTracks.found.length;
    document.getElementById('matcherUncertain').innerText = matchedTracks.uncertain.length;
    document.getElementById('matcherMissing').innerText = matchedTracks.missing.length;
    document.getElementById('foundCount').innerText = matchedTracks.found.length;
    document.getElementById('uncertainCount').innerText = matchedTracks.uncertain.length;
    document.getElementById('missingCount').innerText = matchedTracks.missing.length;
    renderFoundList(); renderUncertainList(); renderMissingList();
}

function renderFoundList() {
    const list = document.getElementById('foundList');
    if (matchedTracks.found.length === 0) { list.innerHTML = '<p class="text-center text-slate-500 py-8">Nessun match trovato.</p>'; return; }
    list.innerHTML = matchedTracks.found.map(t => `<div class="matcher-track found"><i data-lucide="check-circle" class="w-5 h-5 text-green-400"></i><div class="matcher-track-info"><div class="matcher-track-title">${t.original}</div><div class="matcher-track-artist">✅ ${t.match.artist} - ${t.match.title} (Autore: ${Math.round(t.score.artist)}%, Totale: ${Math.round(t.score.total)}%)</div></div></div>`).join('');
    lucide.createIcons();
}

function renderUncertainList() {
    const list = document.getElementById('uncertainList');
    if (matchedTracks.uncertain.length === 0) { list.innerHTML = '<p class="text-center text-slate-500 py-8">Nessun match incerto.</p>'; return; }
    list.innerHTML = matchedTracks.uncertain.map(t => `<div class="matcher-track" style="border-left: 3px solid #EAB308;"><i data-lucide="alert-triangle" class="w-5 h-5 text-yellow-400"></i><div class="matcher-track-info"><div class="matcher-track-title">${t.original}</div><div class="matcher-track-artist">⚠️ ${t.match.artist} - ${t.match.title} (Autore: ${Math.round(t.score.artist)}%, Totale: ${Math.round(t.score.total)}%)</div></div></div>`).join('');
    lucide.createIcons();
}

function renderMissingList() {
    const list = document.getElementById('missingList');
    if (matchedTracks.missing.length === 0) { list.innerHTML = '<p class="text-center text-slate-500 py-8">🎉 Tutte presenti!</p>'; return; }
    list.innerHTML = matchedTracks.missing.map(t => `<div class="matcher-track missing"><i data-lucide="alert-circle" class="w-5 h-5 text-red-400"></i><div class="matcher-track-info"><div class="matcher-track-title">${t.original}</div><div class="matcher-track-artist">❌ Mancante</div></div><button class="matcher-search-btn spotify" onclick="window.open('https://open.spotify.com/search/${encodeURIComponent(t.original)}','_blank')">Spotify</button><button class="matcher-search-btn tidal" onclick="window.open('https://tidal.com/search?q=${encodeURIComponent(t.original)}','_blank')">Tidal</button></div>`).join('');
    lucide.createIcons();
}

document.getElementById('showFoundBtn').addEventListener('click', () => {
    document.getElementById('foundList').classList.remove('hidden'); document.getElementById('uncertainList').classList.add('hidden'); document.getElementById('missingList').classList.add('hidden');
    document.getElementById('showFoundBtn').classList.add('active'); document.getElementById('showUncertainBtn').classList.remove('active'); document.getElementById('showMissingBtn').classList.remove('active');
});
document.getElementById('showUncertainBtn').addEventListener('click', () => {
    document.getElementById('foundList').classList.add('hidden'); document.getElementById('uncertainList').classList.remove('hidden'); document.getElementById('missingList').classList.add('hidden');
    document.getElementById('showUncertainBtn').classList.add('active'); document.getElementById('showFoundBtn').classList.remove('active'); document.getElementById('showMissingBtn').classList.remove('active');
});
document.getElementById('showMissingBtn').addEventListener('click', () => {
    document.getElementById('foundList').classList.add('hidden'); document.getElementById('uncertainList').classList.add('hidden'); document.getElementById('missingList').classList.remove('hidden');
    document.getElementById('showMissingBtn').classList.add('active'); document.getElementById('showFoundBtn').classList.remove('active'); document.getElementById('showUncertainBtn').classList.remove('active');
});

document.getElementById('exportMissingBtn').addEventListener('click', () => {
    if (matchedTracks.missing.length === 0) { alert('Nessuna traccia mancante.'); return; }
    let m3u8 = '#EXTM3U\n# PLAYLIST: AURA - Tracce Mancanti\n';
    matchedTracks.missing.forEach(t => {
        m3u8 += `#EXTINF:210,${t.original}\n# SPOTIFY: https://open.spotify.com/search/${encodeURIComponent(t.original)}\n# TIDAL: https://tidal.com/search?q=${encodeURIComponent(t.original)}\n${t.original}.mp3\n\n`;
    });
    downloadM3U8(m3u8, 'AURA_Mancanti');
});

function downloadM3U8(content, filename) {
    const blob = new Blob([content], { type: 'audio/x-mpegurl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}_${new Date().toISOString().split('T')[0]}.m3u8`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ==================== GLOBAL CHARTS (iTunes API) ====================
document.getElementById('loadChartsBtn').addEventListener('click', async () => {
    const countryId = document.getElementById('countrySelect').value;
    const loading = document.getElementById('chartsLoading');
    const list = document.getElementById('chartsList');
    const error = document.getElementById('chartsError');
    const actions = document.getElementById('chartsActions');
    
    loading.classList.remove('hidden'); 
    list.innerHTML = ''; 
    error.classList.add('hidden');
    actions.classList.add('hidden');
    
    try {
        const url = `https://itunes.apple.com/${countryId}/rss/topsongs/limit=50/json`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Errore: ${response.status}`);
        }
        
        const data = await response.json();
        
        const entries = data.feed?.entry || [];
        
        if (entries.length === 0) {
            throw new Error('Nessuna traccia trovata');
        }
        
        currentCharts = entries.map((entry, idx) => {
            const artist = entry['im:artist']?.label || entry['im:artist'] || 'Unknown';
            const title = entry.title?.label || entry.title || 'Unknown';
            const cover = entry['im:image']?.[2]?.label || entry['im:image']?.[1]?.label || entry['im:image']?.[0]?.label || '';
            return {
                rank: idx + 1,
                title: title,
                artist: artist,
                cover: cover,
                tidalQuery: `${artist} ${title}`.replace(/[^a-zA-Z0-9\s]/g, '')
            };
        });
        
        list.innerHTML = currentCharts.map(t => `
            <div class="chart-track">
                <span class="chart-rank">#${t.rank}</span>
                <img src="${t.cover}" class="chart-cover" onerror="this.style.display='none'">
                <div class="chart-info">
                    <div class="chart-title">${t.title}</div>
                    <div class="chart-artist">${t.artist}</div>
                </div>
            </div>
        `).join('');
        
        actions.classList.remove('hidden');
    } catch (err) {
        error.classList.remove('hidden');
        error.innerHTML = `
            <div class="text-center py-8">
                <i data-lucide="alert-circle" class="w-10 h-10 mx-auto mb-2 text-red-400"></i>
                <p class="font-semibold text-red-400">Impossibile caricare le classifiche</p>
                <p class="text-sm text-slate-400 mt-2">Motivo: ${err.message}</p>
                <p class="text-xs text-slate-500 mt-2">Prova con un altro paese.</p>
            </div>
        `;
        lucide.createIcons();
    } finally { 
        loading.classList.add('hidden'); 
    }
});

document.getElementById('exportM3U8Btn').addEventListener('click', () => {
    if (currentCharts.length === 0) return;
    let m3u8 = '#EXTM3U\n# PLAYLIST: AURA - Global Charts\n';
    currentCharts.forEach(t => {
        m3u8 += `#EXTINF:210,${t.artist} - ${t.title}\n# TIDAL: https://tidal.com/search?q=${encodeURIComponent(t.tidalQuery)}\n${t.artist} - ${t.title}.mp3\n\n`;
    });
    downloadM3U8(m3u8, 'AURA_Charts');
});
