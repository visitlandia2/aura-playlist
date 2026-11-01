lucide.createIcons();
let authMode = 'login';
let userLibrary = []; 
let playlistStructure = {};
let selectedTracks = new Set();
let spotifyPlaylist = [];
let matchedTracks = { found: [], uncertain: [], missing: [] };
let currentCharts = [];

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

// IMPORT LIBRERIA
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
                title: node.getAttribute("Name") || "Unknown"
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
                    const track = { artist: currentArtist, title: currentTitle, playlist: currentPlaylist };
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

// CLOUD
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

// TRACK MATCHER CON ALGORITMO MIGLIORATO
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

// NORMALIZZAZIONE ARTISTA (RIGOROSA)
function normalizeArtist(artist) {
    if (!artist) return '';
    return artist.toString()
        .toLowerCase()
        // Rimuove "feat.", "ft.", "featuring", "vs.", "x"
        .replace(/\s*(feat\.?|ft\.?|featuring|vs\.?|x)\s+[^,;]+/gi, '')
        // Rimuove punteggiatura
        .replace(/[^\w\s]/g, '')
        // Rimuove spazi multipli
        .replace(/\s+/g, ' ')
        .trim();
}

// NORMALIZZAZIONE TITOLO (FLESSIBILE)
function normalizeTitle(title) {
    if (!title) return '';
    return title.toString()
        .toLowerCase()
        // Rimuove "feat.", "ft.", "featuring"
        .replace(/\s*(feat\.?|ft\.?|featuring|vs\.?|x)\s+[^,;]+/gi, '')
        // Rimuove versioni remix/extended
        .replace(/\s*(remix|extended|radio edit|original mix|club mix|instrumental|acoustic|live|version|edit|mix)\s*/gi, '')
        // Rimuove "(Official Video)", "(Audio)", "(Lyrics)", ecc.
        .replace(/\s*\([^)]*(video|audio|lyrics|official|music|hd|hq)[^)]*\)/gi, '')
        // Rimuove punteggiatura
        .replace(/[^\w\s]/g, '')
        // Rimuove spazi multipli
        .replace(/\s+/g, ' ')
        .trim();
}

// CALCOLO SIMILARITÀ ARTISTA (RIGOROSO)
function artistSimilarity(artist1, artist2) {
    const a1 = normalizeArtist(artist1);
    const a2 = normalizeArtist(artist2);
    
    if (a1 === a2) return 100;
    if (a1.length === 0 || a2.length === 0) return 0;
    
    // Se uno contiene l'altro completamente
    if (a1.includes(a2) || a2.includes(a1)) {
        const shorter = Math.min(a1.length, a2.length);
        const longer = Math.max(a1.length, a2.length);
        return (shorter / longer) * 100;
    }
    
    // Confronto parole
    const words1 = a1.split(' ');
    const words2 = a2.split(' ');
    let commonWords = 0;
    
    for (let w1 of words1) {
        for (let w2 of words2) {
            if (w1 === w2) { commonWords++; break; }
        }
    }
    
    const maxWords = Math.max(words1.length, words2.length);
    return (commonWords / maxWords) * 100;
}

// CALCOLO SIMILARITÀ TITOLO (FLESSIBILE)
function titleSimilarity(title1, title2) {
    const t1 = normalizeTitle(title1);
    const t2 = normalizeTitle(title2);
    
    if (t1 === t2) return 100;
    if (t1.length === 0 || t2.length === 0) return 0;
    
    // Se uno contiene l'altro completamente
    if (t1.includes(t2) || t2.includes(t1)) {
        const shorter = Math.min(t1.length, t2.length);
        const longer = Math.max(t1.length, t2.length);
        return (shorter / longer) * 100;
    }
    
    // Confronto parole
    const words1 = t1.split(' ');
    const words2 = t2.split(' ');
    let commonWords = 0;
    
    for (let w1 of words1) {
        for (let w2 of words2) {
            if (w1 === w2) { commonWords++; break; }
        }
    }
    
    const maxWords = Math.max(words1.length, words2.length);
    return (commonWords / maxWords) * 100;
}

function performMatching() {
    if (userLibrary.length === 0) { alert('⚠️ Prima carica la libreria!'); return; }
    
    matchedTracks = { found: [], uncertain: [], missing: [] };
    
    for (let sp of spotifyPlaylist) {
        let bestMatch = null;
        let bestArtistScore = 0;
        let bestTitleScore = 0;
        
        for (let lib of userLibrary) {
            const artistSim = artistSimilarity(sp.artist, lib.artist);
            const titleSim = titleSimilarity(sp.title, lib.title);
            
            // LOGICA INTELLIGENTE:
            // 1. Artista deve matchare almeno 80% (rigoroso)
            // 2. Titolo deve matchare almeno 60% (flessibile)
            // 3. Se entrambi i criteri sono soddisfatti, è un match certo
            
            if (artistSim >= 80 && titleSim >= 60) {
                const totalScore = (artistSim + titleSim) / 2;
                if (totalScore > bestArtistScore + bestTitleScore) {
                    bestMatch = lib;
                    bestArtistScore = artistSim;
                    bestTitleScore = titleSim;
                }
            }
        }
        
        // Classifica il risultato
        if (bestMatch && bestArtistScore >= 80 && bestTitleScore >= 60) {
            matchedTracks.found.push({ 
                ...sp, 
                match: bestMatch, 
                artistScore: bestArtistScore,
                titleScore: bestTitleScore
            });
        } else if (bestMatch && bestArtistScore >= 60) {
            // Artista simile ma titolo diverso -> incerto
            matchedTracks.uncertain.push({ 
                ...sp, 
                match: bestMatch,
                artistScore: bestArtistScore,
                titleScore: bestTitleScore
            });
        } else {
            // Nessun match valido
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
    if (matchedTracks.found.length === 0) { list.innerHTML = '<p class="text-center text-slate-500 py-8">Nessun match.</p>'; return; }
    list.innerHTML = matchedTracks.found.map(t => `<div class="matcher-track found"><i data-lucide="check-circle" class="w-5 h-5 text-green-400"></i><div class="matcher-track-info"><div class="matcher-track-title">${t.original}</div><div class="matcher-track-artist">✅ ${t.match.artist} - ${t.match.title} (Artista: ${Math.round(t.artistScore)}%, Titolo: ${Math.round(t.titleScore)}%)</div></div></div>`).join('');
    lucide.createIcons();
}

function renderUncertainList() {
    const list = document.getElementById('uncertainList');
    if (matchedTracks.uncertain.length === 0) { list.innerHTML = '<p class="text-center text-slate-500 py-8">Nessun incerto.</p>'; return; }
    list.innerHTML = matchedTracks.uncertain.map(t => `<div class="matcher-track" style="border-left: 3px solid #EAB308;"><i data-lucide="alert-triangle" class="w-5 h-5 text-yellow-400"></i><div class="matcher-track-info"><div class="matcher-track-title">${t.original}</div><div class="matcher-track-artist">⚠️ ${t.match.artist} - ${t.match.title} (Artista: ${Math.round(t.artistScore)}%, Titolo: ${Math.round(t.titleScore)}%)</div></div></div>`).join('');
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
    let m3u8 = '#EXTM3U\n# PLAYLIST: AURA - Mancanti\n';
    matchedTracks.missing.forEach(t => {
        m3u8 += `#EXTINF:210,${t.original}\n# SPOTIFY: https://open.spotify.com/search/${encodeURIComponent(t.original)}\n${t.original}.mp3\n\n`;
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

// GLOBAL CHARTS
document.getElementById('loadChartsBtn').addEventListener('click', async () => {
    const countryId = document.getElementById('countrySelect').value;
    const loading = document.getElementById('chartsLoading');
    const list = document.getElementById('chartsList');
    const error = document.getElementById('chartsError');
    const actions = document.getElementById('chartsActions');
    loading.classList.remove('hidden'); list.innerHTML = ''; error.classList.add('hidden'); actions.classList.add('hidden');
    try {
        const url = countryId === '0' ? 'https://api.deezer.com/chart/0/tracks?limit=50' : `https://api.deezer.com/chart/${countryId}/tracks?limit=50`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);
        const data = await response.json();
        if (!data.data || data.data.length === 0) throw new Error('Nessuna traccia');
        currentCharts = data.data.map((track, idx) => ({
            rank: idx + 1, title: track.title, artist: track.artist.name, cover: track.album.cover_medium,
            tidalQuery: `${track.artist.name} ${track.title}`.replace(/[^a-zA-Z0-9\s]/g, '')
        }));
        list.innerHTML = currentCharts.map(t => `<div class="chart-track"><span class="chart-rank">#${t.rank}</span><img src="${t.cover}" class="chart-cover"><div class="chart-info"><div class="chart-title">${t.title}</div><div class="chart-artist">${t.artist}</div></div></div>`).join('');
        actions.classList.remove('hidden');
    } catch (err) {
        error.classList.remove('hidden');
        error.innerHTML = `<p>❌ Errore: ${err.message}</p><p class="text-xs text-slate-500 mt-2">Prova un altro paese o controlla internet.</p>`;
    } finally { loading.classList.add('hidden'); }
});

document.getElementById('exportM3U8Btn').addEventListener('click', () => {
    if (currentCharts.length === 0) return;
    let m3u8 = '#EXTM3U\n# PLAYLIST: AURA - Global Charts\n';
    currentCharts.forEach(t => {
        m3u8 += `#EXTINF:210,${t.artist} - ${t.title}\n# TIDAL: https://tidal.com/search?q=${encodeURIComponent(t.tidalQuery)}\n${t.artist} - ${t.title}.mp3\n\n`;
    });
    downloadM3U8(m3u8, 'AURA_Charts');
});
