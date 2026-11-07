document.addEventListener('DOMContentLoaded', function() {
  lucide.createIcons();
  let authMode = 'login';
  let userLibrary = [];
  let playlistStructure = {};
  let selectedTracks = new Set();
  let lastMatched = { found: [], missing: [], spotifyTracks: [] };
  let currentCharts = [];

  const CLIENT_ID = '1308767b4c5946dab3c421a3b58bc8b4';
  const CLIENT_SECRET = '5c0fd128f6e4475f97455bc22b0743d0';
  const WORKER_URL = 'https://aura-spotify-proxy.visitlandia2.workers.dev';

  const CAMELOT_MAP = {'am':'8A','a':'8A','em':'9A','e':'9A','bm':'10A','b':'10A','f#m':'11A','gbm':'11A','c#m':'12A','dbm':'12A','g#m':'1A','abm':'1A','d#m':'2A','ebm':'2A','a#m':'3A','bbm':'3A','c':'8B','g':'9B','d':'10B','a':'11B','e':'12B','b':'1B','f#':'2B','gb':'2B','c#':'3B','db':'3B','g#':'4B','ab':'4B','d#':'5B','eb':'5B','a#':'6B','bb':'6B','f':'7B'};
  function getCamelot(k){if(!k)return'?';const x=k.toString().toLowerCase().trim();if(/^\d+[AB]$/.test(x))return x.toUpperCase();return CAMELOT_MAP[x]||'?';}
  function getEnergy(bpm){if(!bpm||bpm==='?')return 5;const b=parseFloat(bpm);if(b<110)return 3;if(b<120)return 5;if(b<128)return 7;return 9;}

  function showMsg(t, type='error') {
    const m = document.getElementById('authMessage');
    if (!m) return;
    m.classList.remove('hidden');
    m.className = type === 'error' 
      ? 'mb-4 p-3 rounded-lg text-sm bg-red-500/20 border border-red-500 text-red-300'
      : 'mb-4 p-3 rounded-lg text-sm bg-green-500/20 border border-green-500 text-green-300';
    m.innerText = t;
  }

  function updateAuthUI() {
    const b = document.getElementById('authBtn');
    const s = document.getElementById('switchText');
    const sw = document.getElementById('switchBtn');
    if (!b) return;
    if (authMode === 'login') {
      b.innerText = 'Accedi';
      s.innerText = 'Non hai un account?';
      sw.innerText = 'Registrati';
    } else {
      b.innerText = 'Crea Account';
      s.innerText = 'Hai già un account?';
      sw.innerText = 'Accedi';
    }
  }

  document.getElementById('authBtn').onclick = async function() {
    const em = document.getElementById('email').value.trim();
    const pw = document.getElementById('password').value;
    const b = document.getElementById('authBtn');
    const oldText = b.innerText;
    
    if (!em || !pw) {
      showMsg('❌ Inserisci email e password', 'error');
      return;
    }
    
    b.disabled = true;
    b.innerText = '...';
    
    try {
      if (authMode === 'login') {
        await supabase.signIn(em, pw);
        showDash();
      } else {
        await supabase.signUp(em, pw);
        showMsg('✅ Account creato! Ora clicca Accedi', 'success');
        authMode = 'login';
        updateAuthUI();
      }
    } catch (err) {
      showMsg('❌ ' + (err.message || 'Errore'), 'error');
    } finally {
      b.disabled = false;
      b.innerText = oldText;
    }
  };

  document.getElementById('switchBtn').onclick = function() {
    authMode = authMode === 'login' ? 'register' : 'login';
    updateAuthUI();
    document.getElementById('authMessage').classList.add('hidden');
  };

  document.getElementById('forgotBtn').onclick = function() {
    const em = document.getElementById('email').value.trim();
    if (!em) { alert('Inserisci prima la email'); return; }
    alert('Per resettare la password, crea un nuovo account.');
  };

  function showDash() {
    const u = supabase.getUser();
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('dashboardScreen').classList.remove('hidden');
    if (u && u.email) document.getElementById('userEmail').innerText = u.email;
    loadSaved();
  }

  function logout() {
    supabase.signOut();
    document.getElementById('dashboardScreen').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
  }

  if (supabase.isLoggedIn()) showDash();
  else updateAuthUI();

  const dz = document.getElementById('dropZone');
  const fi = document.getElementById('fileInput');
  ['dragenter','dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('border-aura-gold'); }));
  ['dragleave','drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('border-aura-gold'); }));
  dz.addEventListener('drop', e => { if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); });
  fi.onchange = e => { if (e.target.files.length) handleFile(e.target.files[0]); };

  function handleFile(file) {
    document.getElementById('dropText').innerText = 'Analisi...';
    const r = new FileReader();
    r.onload = e => {
      const c = e.target.result;
      let tracks = [], pls = {};
      if (file.name.endsWith('.xml')) {
        const p = new DOMParser();
        const x = p.parseFromString(c, 'text/xml');
        tracks = Array.from(x.getElementsByTagName('TRACK')).map(n => ({
          artist: n.getAttribute('Artist') || 'Unknown',
          title: n.getAttribute('Name') || 'Unknown',
          bpm: n.getAttribute('BPM') || '?',
          key: getCamelot(n.getAttribute('Key') || '?'),
          energy: getEnergy(n.getAttribute('BPM'))
        }));
        pls = { 'Collection': tracks };
      } else if (file.name.endsWith('.m3u8') || file.name.endsWith('.m3u')) {
        const lines = c.split(/\r?\n/);
        let cp = 'Collection', ct = '', ca = '';
        pls[cp] = [];
        for (let l of lines) {
          l = l.trim();
          if (l.startsWith('#PLAYLIST:')) {
            cp = l.substring(10).trim();
            if (!pls[cp]) pls[cp] = [];
          } else if (l.startsWith('#EXTINF:')) {
            const ci = l.indexOf(',');
            if (ci > -1) {
              const m = l.substring(ci + 1).trim();
              const p = m.split(' - ');
              if (p.length >= 2) { ca = p[0].trim(); ct = p.slice(1).join(' - ').trim(); }
              else { ca = 'Unknown'; ct = m; }
            }
          } else if (l && !l.startsWith('#') && ct !== '') {
            const t = { artist: ca, title: ct, bpm: '?', key: '?', energy: 5, playlist: cp };
            tracks.push(t);
            if (!pls[cp]) pls[cp] = [];
            pls[cp].push(t);
            ct = ''; ca = '';
          }
        }
      } else { alert('Formato non supportato'); return; }
      userLibrary = tracks;
      playlistStructure = pls;
      document.getElementById('dropText').innerText = 'Trascina qui il file';
      document.getElementById('resultArea').classList.remove('hidden');
      document.getElementById('resultText').innerText = `✅ ${tracks.length} tracce in ${Object.keys(pls).length} playlist`;
      renderTree();
      saveCloud();
    };
    r.readAsText(file);
  }

  function renderTree() {
    const t = document.getElementById('playlistTree');
    if (!Object.keys(playlistStructure).length) {
      t.innerHTML = '<p class="text-center text-slate-500 py-8">Nessuna playlist</p>';
      return;
    }
    let h = '';
    for (let [n, tr] of Object.entries(playlistStructure)) {
      h += `<div class="mb-2"><div class="folder-h bg-slate-800 p-2 rounded cursor-pointer flex justify-between" onclick="this.nextElementSibling.classList.toggle('hidden')"><span>📁 ${n}</span><span class="text-xs text-slate-400">${tr.length} tracce</span></div><div class="ml-4 mt-1 hidden">`;
      tr.forEach((tk, i) => {
        h += `<label class="flex items-center gap-2 p-1 hover:bg-slate-800 rounded cursor-pointer"><input type="checkbox" class="tcb" data-id="${n}-${i}" onchange="updSel()"> <span class="text-sm">${tk.artist} - ${tk.title}</span></label>`;
      });
      h += '</div></div>';
    }
    t.innerHTML = h;
  }

  document.getElementById('expandAllBtn').onclick = () => document.querySelectorAll('.folder-h+div').forEach(d => d.classList.remove('hidden'));
  document.getElementById('collapseAllBtn').onclick = () => document.querySelectorAll('.folder-h+div').forEach(d => d.classList.add('hidden'));
  document.getElementById('selectAllBtn').onclick = () => { document.querySelectorAll('.tcb').forEach(c => c.checked = true); updSel(); };

  function updSel() {
    selectedTracks.clear();
    document.querySelectorAll('.tcb:checked').forEach(c => selectedTracks.add(c.dataset.id));
    document.getElementById('selectedCount').innerText = selectedTracks.size;
  }

  async function saveCloud() {
    if (!supabase.isLoggedIn() || !userLibrary.length) return;
    try { await supabase.saveLibrary(userLibrary, 'Libreria_Engine_DJ'); console.log('✅ Salvata'); }
    catch (e) { console.error('❌ Errore salvataggio:', e); }
  }

  async function loadSaved() {
    if (!supabase.isLoggedIn()) return;
    try {
      const s = await supabase.loadLibrary();
      if (s && s.tracks && s.tracks.length) {
        userLibrary = s.tracks;
        playlistStructure = { 'Collection': userLibrary };
        renderTree();
        console.log('✅ Caricata:', userLibrary.length, 'tracce');
      }
    } catch (e) { console.error('❌ Errore caricamento:', e); }
  }

  const NOISE = ['remaster','remastered','2019','2020','2021','2022','2023','2024','2025','official video','official audio','feat','ft','featuring','remix','extended','radio edit','club mix','live','version','edit','mix','hq','hd'];
  function norm(t, strict = false) {
    if (!t) return '';
    let n = t.toString().toLowerCase().replace(/[~"'`´^]/g, ' ').replace(/\s*-\s*/g, ' ').replace(/\s*[\(\)\[\]]/g, ' ').replace(/\s*(feat\.?|ft\.?|featuring|vs\.?| x )\s+[^,;]+/gi, ' ');
    if (!strict) for (let w of NOISE) n = n.replace(new RegExp('\\b' + w + '\\b', 'gi'), ' ');
    return n.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function sim(a, b) {
    if (a === b) return 100;
    if (!a || !b) return 0;
    if (a.includes(b) || b.includes(a)) return (Math.min(a.length, b.length) / Math.max(a.length, b.length)) * 100;
    const w1 = a.split(' ').filter(w => w.length > 1);
    const w2 = b.split(' ').filter(w => w.length > 1);
    let c = 0;
    for (let x of w1) for (let y of w2) if (x === y) { c++; break; }
    return (c / Math.max(w1.length, w2.length)) * 100;
  }

  async function fetchFromWorker(endpoint, options = {}) {
    const url = WORKER_URL + endpoint;
    console.log('📡 Chiamata a:', url);
    try {
      const response = await fetch(url, options);
      console.log('✅ Risposta:', response.status);
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response;
    } catch (e) {
      console.error('❌ Errore fetch:', e);
      throw new Error('Connessione al Worker fallita');
    }
  }

  document.getElementById('fetchSpotifyBtn').onclick = async () => {
    const link = document.getElementById('spotifyLink').value.trim();
    const ld = document.getElementById('spotifyLoading');
    const er = document.getElementById('spotifyError');
    if (!link) { alert('Incolla il link Spotify'); return; }
    const m = link.match(/playlist\/([a-zA-Z0-9]+)/);
    if (!m) { alert('Link non valido'); return; }
    const pid = m[1];
    ld.classList.remove('hidden');
    er.classList.add('hidden');
    try {
      const tokRes = await fetchFromWorker('/token', { method: 'POST' });
      const tok = await tokRes.json();
      if (!tok.access_token) throw new Error('Token non ricevuto');
      const trRes = await fetchFromWorker(`/playlist/${pid}`, { headers: { 'Authorization': 'Bearer ' + tok.access_token } });
      const data = await trRes.json();
      const tracks = data.items.map(i => {
        const t = i.track;
        if (!t) return null;
        return { artist: t.artists.map(a => a.name).join(', '), title: t.name, original: t.artists.map(a => a.name).join(', ') + ' - ' + t.name };
      }).filter(t => t);
      if (!tracks.length) throw new Error('Nessuna traccia');
      lastMatched.spotifyTracks = tracks;
      doMatch(tracks);
    } catch (e) {
      er.classList.remove('hidden');
      er.innerHTML = `❌ ${e.message}<br><div class="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs"><strong>💡 Alternativa:</strong> Usa <a href="https://www.tunemymusic.com/it/" target="_blank" class="underline text-aura-gold">TuneMyMusic</a> per esportare in CSV</div>`;
    } finally { ld.classList.add('hidden'); }
  };

  const mdz = document.getElementById('matcherDropZone');
  const mfi = document.getElementById('matcherFileInput');
  ['dragenter','dragover'].forEach(ev => mdz.addEventListener(ev, e => { e.preventDefault(); mdz.classList.add('border-aura-gold'); }));
  ['dragleave','drop'].forEach(ev => mdz.addEventListener(ev, e => { e.preventDefault(); mdz.classList.remove('border-aura-gold'); }));
  mdz.addEventListener('drop', e => { if (e.dataTransfer.files.length) handleMatcherFile(e.dataTransfer.files[0]); });
  mfi.onchange = e => { if (e.target.files.length) handleMatcherFile(e.target.files[0]); };

  function handleMatcherFile(file) {
    document.getElementById('matcherDropText').innerText = 'Analisi...';
    const r = new FileReader();
    r.onload = e => {
      const tracks = parseFile(e.target.result, file.name);
      if (!tracks.length) { alert('Nessuna traccia'); document.getElementById('matcherDropText').innerText = 'Trascina qui il file'; return; }
      lastMatched.spotifyTracks = tracks;
      doMatch(tracks);
    };
    r.readAsText(file);
  }

  function parseFile(content, filename) {
    const tracks = [];
    if (filename.endsWith('.csv')) {
      const lines = content.split(/\r?\n/);
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
        if (cols.length >= 2 && cols[0] && cols[1]) tracks.push({ artist: cols[0], title: cols[1], original: cols[0] + ' - ' + cols[1] });
      }
    } else {
      const lines = content.split(/\r?\n/);
      for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;
        const parts = line.split(' - ').map(p => p.trim()).filter(p => p.length > 0);
        if (parts.length < 2) continue;
        let artist, title;
        if (parts.length === 2) {
          if (parts[0].split(' ').length <= parts[1].split(' ').length) { artist = parts[0]; title = parts[1]; }
          else { title = parts[0]; artist = parts[1]; }
        } else { artist = parts[parts.length - 1]; title = parts.slice(0, -1).join(' - '); }
        if (artist && title) tracks.push({ artist, title, original: line });
      }
    }
    return tracks;
  }

  function doMatch(spTracks) {
    if (!userLibrary.length) { alert('⚠️ Carica prima la libreria!'); return; }
    const found = [], missing = [];
    for (let sp of spTracks) {
      let best = null, bs = { t: 0, a: 0 };
      for (let lib of userLibrary) {
        const as = sim(norm(sp.artist, true), norm(lib.artist, true));
        const ts = sim(norm(sp.title, false), norm(lib.title, false));
        const tot = as >= 90 ? as * 0.8 + ts * 0.2 : as * 0.6 + ts * 0.4;
        if (tot > bs.t) { bs = { t: tot, a: as }; best = lib; }
      }
      if (bs.a >= 85) found.push({ ...sp, match: best, score: bs });
      else missing.push(sp);
    }
    lastMatched = { found, missing, spotifyTracks: spTracks };
    document.getElementById('matcherResults').classList.remove('hidden');
    document.getElementById('mTotal').innerText = spTracks.length;
    document.getElementById('mFound').innerText = found.length;
    document.getElementById('mMissing').innerText = missing.length;
    renderFound();
    renderMissing();
  }

  function renderFound() {
    const l = document.getElementById('foundList');
    if (!lastMatched.found.length) { l.innerHTML = '<p class="text-center text-slate-500 py-4">Nessun match</p>'; return; }
    l.innerHTML = lastMatched.found.map(t => `<div class="bg-green-500/10 border border-green-500/30 rounded p-2 flex items-center gap-2"><i data-lucide="check-circle" class="w-4 h-4 text-green-400"></i><div class="flex-1 min-w-0"><div class="text-sm font-semibold truncate">${t.original}</div><div class="text-xs text-slate-400">✅ ${t.match.artist} - ${t.match.title}</div></div></div>`).join('');
    lucide.createIcons();
  }

  function renderMissing() {
    const l = document.getElementById('missingList');
    if (!lastMatched.missing.length) { l.innerHTML = '<p class="text-center text-slate-500 py-4">🎉 Tutte presenti!</p>'; return; }
    l.innerHTML = lastMatched.missing.map(t => `<div class="bg-red-500/10 border border-red-500/30 rounded p-2 flex items-center gap-2"><i data-lucide="x-circle" class="w-4 h-4 text-red-400"></i><div class="flex-1 min-w-0"><div class="text-sm font-semibold truncate">${t.original}</div><div class="text-xs text-slate-400">❌ Mancante</div></div><a href="https://open.spotify.com/search/${encodeURIComponent(t.original)}" target="_blank" class="text-xs bg-green-600 px-2 py-1 rounded text-white">🔍</a></div>`).join('');
    lucide.createIcons();
  }

  document.getElementById('tabFound').onclick = () => {
    document.getElementById('foundList').classList.remove('hidden');
    document.getElementById('missingList').classList.add('hidden');
    document.getElementById('tabFound').classList.add('active');
    document.getElementById('tabMissing').classList.remove('active');
  };

  document.getElementById('tabMissing').onclick = () => {
    document.getElementById('foundList').classList.add('hidden');
    document.getElementById('missingList').classList.remove('hidden');
    document.getElementById('tabMissing').classList.add('active');
    document.getElementById('tabFound').classList.remove('active');
  };

  document.getElementById('exportPresentM3U8Btn').onclick = () => {
    if (!lastMatched.found.length) { alert('Nessuna traccia presente'); return; }
    let m = '#EXTM3U\n# PLAYLIST: AURA - Tracce Presenti\n\n';
    lastMatched.found.forEach(t => { m += `#EXTINF:210,${t.match.artist} - ${t.match.title}\n${t.match.artist} - ${t.match.title}.mp3\n\n`; });
    dl(m, 'AURA_Presenti');
  };

  document.getElementById('exportMissingM3U8Btn').onclick = () => {
    if (!lastMatched.missing.length) { alert('Nessuna traccia mancante'); return; }
    let m = '#EXTM3U\n# PLAYLIST: AURA - Tracce Mancanti\n\n';
    lastMatched.missing.forEach(t => { m += `#EXTINF:210,${t.original}\n# SPOTIFY: https://open.spotify.com/search/${encodeURIComponent(t.original)}\n${t.original}.mp3\n\n`; });
    dl(m, 'AURA_Mancanti');
  };

  document.getElementById('exportMissingSpotifyBtn').onclick = () => {
    if (!lastMatched.missing.length) { alert('Nessuna traccia mancante'); return; }
    const names = lastMatched.missing.map(t => encodeURIComponent(t.artist + ' ' + t.title)).join(',');
    window.open(`https://open.spotify.com/search/${names}`, '_blank');
  };

  document.getElementById('createSpotifyPlaylistBtn').onclick = () => {
    if (!lastMatched.missing.length) { alert('Nessuna traccia mancante'); return; }
    const names = lastMatched.missing.map(t => encodeURIComponent(t.artist + ' ' + t.title)).join(',');
    window.open(`https://open.spotify.com/search/${names}`, '_blank');
  };

  function dl(c, f) {
    const b = new Blob([c], { type: 'audio/x-mpegurl' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u;
    a.download = f + '_' + new Date().toISOString().split('T')[0] + '.m3u8';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(u);
  }

  document.getElementById('loadChartsBtn').onclick = async () => {
    const c = document.getElementById('countrySelect').value;
    const l = document.getElementById('chartsList');
    const ca = document.getElementById('chartsActions');
    l.innerHTML = '<p class="text-center text-slate-400 py-4">Caricamento...</p>';
    ca.classList.add('hidden');
    try {
      const r = await fetch(`https://itunes.apple.com/${c}/rss/topsongs/limit=50/json`);
      if (!r.ok) throw new Error('Errore');
      const d = await r.json();
      const e = d.feed?.entry || [];
      if (!e.length) throw new Error('Nessuna traccia');
      currentCharts = e.map((x, i) => ({ rank: i + 1, title: x.title?.label || 'Unknown', artist: x['im:artist']?.label || 'Unknown', cover: x['im:image']?.[2]?.label || '' }));
      l.innerHTML = currentCharts.map(t => `<div class="bg-slate-900/50 border border-slate-700 rounded p-2 flex items-center gap-2"><span class="text-aura-gold font-bold w-8">#${t.rank}</span><img src="${t.cover}" class="w-10 h-10 rounded"><div class="flex-1 min-w-0"><div class="text-sm font-semibold truncate">${t.title}</div><div class="text-xs text-slate-400">${t.artist}</div></div></div>`).join('');
      ca.classList.remove('hidden');
    } catch (e) { l.innerHTML = `<p class="text-center text-red-400 py-4">❌ ${e.message}</p>`; }
  };

  document.getElementById('exportChartsBtn').onclick = () => {
    if (!currentCharts.length) return;
    let m = '#EXTM3U\n# PLAYLIST: AURA - Global Charts\n\n';
    currentCharts.forEach(t => { m += `#EXTINF:210,${t.artist} - ${t.title}\n${t.artist} - ${t.title}.mp3\n\n`; });
    dl(m, 'AURA_Charts');
  };
});
