(function() {
  'use strict';

  function init() {
    if (typeof lucide !== 'undefined') lucide.createIcons();

    let authMode = 'login';
    let userLibrary = [];
    let playlistStructure = {};
    let selectedTracks = new Set();
    let lastMatched = { found: [], missing: [], spotifyTracks: [], playlistName: 'Playlist' };
    const WORKER_URL = 'https://aura-spotify-proxy.visitlandia2.workers.dev';

    function showMsg(t, type) {
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

    const authBtn = document.getElementById('authBtn');
    if (authBtn) {
      authBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        const em = document.getElementById('email').value.trim();
        const pw = document.getElementById('password').value;
        const b = document.getElementById('authBtn');
        const oldText = b.innerText;
        if (!em || !pw) { showMsg('❌ Inserisci email e password', 'error'); return; }
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
      });
    }

    const switchBtn = document.getElementById('switchBtn');
    if (switchBtn) {
      switchBtn.addEventListener('click', function(e) {
        e.preventDefault();
        authMode = authMode === 'login' ? 'register' : 'login';
        updateAuthUI();
        const m = document.getElementById('authMessage');
        if (m) m.classList.add('hidden');
      });
    }

    function showDash() {
      const u = supabase.getUser();
      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('dashboardScreen').classList.remove('hidden');
      if (u && u.email) document.getElementById('userEmail').innerText = u.email;
      loadSaved();
    }

    window.logout = function() {
      supabase.signOut();
      document.getElementById('dashboardScreen').classList.add('hidden');
      document.getElementById('loginScreen').classList.remove('hidden');
      document.getElementById('email').value = '';
      document.getElementById('password').value = '';
    };

    if (supabase.isLoggedIn()) showDash(); else updateAuthUI();

    const dz = document.getElementById('dropZone');
    const fi = document.getElementById('fileInput');
    if (dz && fi) {
      ['dragenter','dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('border-aura-gold'); }));
      ['dragleave','drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('border-aura-gold'); }));
      dz.addEventListener('drop', e => { if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); });
      fi.onchange = e => { if (e.target.files.length) handleFile(e.target.files[0]); };
    }

    function handleFile(file) {
      document.getElementById('dropText').innerText = 'Analisi...';
      const r = new FileReader();
      r.onload = e => {
        const c = e.target.result; let tracks = [], pls = {};
        if (file.name.endsWith('.xml')) {
          const x = new DOMParser().parseFromString(c, 'text/xml');
          tracks = Array.from(x.getElementsByTagName('TRACK')).map(n => ({
            artist: n.getAttribute('Artist')||'Unknown',
            title: n.getAttribute('Name')||'Unknown',
            bpm: n.getAttribute('BPM')||'?',
            key: '?',
            energy: 5
          }));
          pls = { 'Collection': tracks };
        } else if (file.name.endsWith('.m3u8') || file.name.endsWith('.m3u')) {
          const lines = c.split(/\r?\n/); let cp = 'Collection', ct = '', ca = ''; pls[cp] = [];
          for (let l of lines) {
            l = l.trim();
            if (l.startsWith('#PLAYLIST:')) { cp = l.substring(10).trim(); if (!pls[cp]) pls[cp] = []; }
            else if (l.startsWith('#EXTINF:')) { const ci = l.indexOf(','); if (ci > -1) { const p = l.substring(ci + 1).trim().split(' - '); ca = p.length >= 2 ? p[0].trim() : 'Unknown'; ct = p.length >= 2 ? p.slice(1).join(' - ').trim() : p[0].trim(); } }
            else if (l && !l.startsWith('#') && ct !== '') { const t = { artist: ca, title: ct, bpm: '?', key: '?', energy: 5, playlist: cp }; tracks.push(t); if (!pls[cp]) pls[cp] = []; pls[cp].push(t); ct = ''; ca = ''; }
          }
        } else { alert('Formato non supportato'); return; }
        userLibrary = tracks; playlistStructure = pls;
        document.getElementById('dropText').innerText = 'Trascina qui il file';
        document.getElementById('resultArea').classList.remove('hidden');
        document.getElementById('resultText').innerText = `✅ ${tracks.length} tracce in ${Object.keys(pls).length} playlist`;
        renderTree(); saveCloud();
      };
      r.readAsText(file);
    }

    function renderTree() {
      const t = document.getElementById('playlistTree'); if (!t) return;
      if (!Object.keys(playlistStructure).length) { t.innerHTML = '<p class="text-center text-slate-500 py-8">Nessuna playlist</p>'; return; }
      let h = '';
      for (let n in playlistStructure) {
        const tr = playlistStructure[n];
        h += `<div class="mb-2"><div class="folder-h bg-slate-800 p-2 rounded cursor-pointer flex justify-between" onclick="this.nextElementSibling.classList.toggle('hidden')"><span>📁 ${n}</span><span class="text-xs text-slate-400">${tr.length} tracce</span></div><div class="ml-4 mt-1 hidden">`;
        tr.forEach((tk, i) => { h += `<label class="flex items-center gap-2 p-1 hover:bg-slate-800 rounded cursor-pointer"><input type="checkbox" class="tcb" data-id="${n}-${i}" onchange="updSel()"> <span class="text-sm">${tk.artist} - ${tk.title}</span></label>`; });
        h += '</div></div>';
      }
      t.innerHTML = h;
    }

    window.updSel = function() {
      selectedTracks.clear();
      document.querySelectorAll('.tcb:checked').forEach(c => selectedTracks.add(c.dataset.id));
      document.getElementById('selectedCount').innerText = selectedTracks.size;
    };

    document.getElementById('expandAllBtn').onclick = () => document.querySelectorAll('.folder-h+div').forEach(d => d.classList.remove('hidden'));
    document.getElementById('collapseAllBtn').onclick = () => document.querySelectorAll('.folder-h+div').forEach(d => d.classList.add('hidden'));
    document.getElementById('selectAllBtn').onclick = () => { document.querySelectorAll('.tcb').forEach(c => c.checked = true); updSel(); };

    async function saveCloud() { if (supabase.isLoggedIn() && userLibrary.length) { try { await supabase.saveLibrary(userLibrary, 'Libreria'); } catch(e){} } }
    async function loadSaved() {
      if (!supabase.isLoggedIn()) return;
      try {
        const s = await supabase.loadLibrary();
        if (s && s.tracks && s.tracks.length) { userLibrary = s.tracks; playlistStructure = { 'Collection': userLibrary }; renderTree(); }
      } catch(e){}
    }

    function norm(t) { if (!t) return ''; return t.toString().toLowerCase().replace(/[~"'`´^\(\)\[\]]/g, ' ').replace(/\s*-\s*/g, ' ').replace(/\s*(feat\.?|ft\.?|featuring|vs\.?| x )\s+[^,;]+/gi, ' ').replace(/\b(remaster|remastered|2019|2020|2021|2022|2023|2024|2025|official|video|audio|remix|extended|radio|edit|club|mix|live|version|hq|hd)\b/gi, ' ').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
    function sim(a, b) {
      if (a === b) return 100; if (!a || !b) return 0;
      if (a.includes(b) || b.includes(a)) return (Math.min(a.length, b.length) / Math.max(a.length, b.length)) * 100;
      const w1 = a.split(' ').filter(w => w.length > 1), w2 = b.split(' ').filter(w => w.length > 1);
      let c = 0; for (let x of w1) for (let y of w2) if (x === y) { c++; break; }
      return (c / Math.max(w1.length, w2.length)) * 100;
    }

    // LETTURA PLAYLIST SPOTIFY
    document.getElementById('fetchSpotifyBtn').onclick = async function() {
      const link = document.getElementById('spotifyLink').value.trim();
      const ld = document.getElementById('spotifyLoading'), er = document.getElementById('spotifyError');
      if (!link) { alert('Incolla il link Spotify'); return; }
      const m = link.match(/playlist\/([a-zA-Z0-9]+)/);
      if (!m) { alert('Link non valido'); return; }
      const pid = m[1];
      
      ld.classList.remove('hidden'); 
      er.classList.add('hidden');
      
      try {
        const response = await fetch(WORKER_URL + '/playlist?id=' + pid);
        
        // Prima prova a parsare come JSON
        const text = await response.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch(e) {
          throw new Error('Il server ha risposto con un formato non valido. Riprova tra qualche secondo.');
        }
        
        if (data.error) throw new Error(data.error);
        if (!data.items || data.items.length === 0) throw new Error('Nessuna traccia trovata.');
        
        const tracks = data.items.map(i => ({
          artist: i.track.artist,
          title: i.track.title,
          original: i.track.original
        }));
        
        lastMatched.playlistName = data.name || 'Playlist Spotify';
        lastMatched.spotifyTracks = tracks; 
        doMatch(tracks);
      } catch (e) {
        er.classList.remove('hidden');
        er.innerHTML = `❌ ${e.message}<br><br><span class="text-xs text-slate-400">💡 Alternativa sicura:<br>1. Vai su <a href="https://exportify.app/" target="_blank" class="text-aura-gold underline">Exportify.app</a><br>2. Autorizza con Spotify<br>3. Esporta la playlist in CSV<br>4. Carica il CSV nel Metodo 2 qui sotto</span>`;
      } finally { 
        ld.classList.add('hidden'); 
      }
    };

    const mdz = document.getElementById('matcherDropZone'), mfi = document.getElementById('matcherFileInput');
    if (mdz && mfi) {
      ['dragenter','dragover'].forEach(ev => mdz.addEventListener(ev, e => { e.preventDefault(); mdz.classList.add('border-aura-gold'); }));
      ['dragleave','drop'].forEach(ev => mdz.addEventListener(ev, e => { e.preventDefault(); mdz.classList.remove('border-aura-gold'); }));
      mdz.addEventListener('drop', e => { if (e.dataTransfer.files.length) handleMatcherFile(e.dataTransfer.files[0]); });
      mfi.onchange = e => { if (e.target.files.length) handleMatcherFile(e.target.files[0]); };
    }

    function handleMatcherFile(file) {
      document.getElementById('matcherDropText').innerText = 'Analisi...';
      const r = new FileReader();
      r.onload = e => {
        const tracks = parseFile(e.target.result, file.name);
        if (!tracks.length) { alert('Nessuna traccia'); document.getElementById('matcherDropText').innerText = 'Trascina qui il file'; return; }
        lastMatched.spotifyTracks = tracks; 
        lastMatched.playlistName = file.name.replace(/\.[^.]+$/, '');
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
          line = line.trim(); if (!line || line.startsWith('#')) continue;
          const parts = line.split(' - ').map(p => p.trim()).filter(p => p.length > 0);
          if (parts.length < 2) continue;
          let artist = parts[0], title = parts[1];
          if (parts.length > 2) { artist = parts[parts.length - 1]; title = parts.slice(0, -1).join(' - '); }
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
          const as = sim(norm(sp.artist), norm(lib.artist)), ts = sim(norm(sp.title), norm(lib.title));
          const tot = as >= 90 ? as * 0.8 + ts * 0.2 : as * 0.6 + ts * 0.4;
          if (tot > bs.t) { bs = { t: tot, a: as }; best = lib; }
        }
        if (bs.a >= 85) found.push({ ...sp, match: best, score: bs }); else missing.push(sp);
      }
      lastMatched = { ...lastMatched, found, missing, spotifyTracks: spTracks };
      document.getElementById('matcherResults').classList.remove('hidden');
      document.getElementById('mTotal').innerText = spTracks.length;
      document.getElementById('mFound').innerText = found.length;
      document.getElementById('mMissing').innerText = missing.length;
      renderFound(); renderMissing();
    }

    function renderFound() {
      const l = document.getElementById('foundList'); if (!l) return;
      if (!lastMatched.found.length) { l.innerHTML = '<p class="text-center text-slate-500 py-4">Nessun match</p>'; return; }
      l.innerHTML = lastMatched.found.map(t => `<div class="bg-green-500/10 border border-green-500/30 rounded p-2 flex items-center gap-2"><i data-lucide="check-circle" class="w-4 h-4 text-green-400"></i><div class="flex-1 min-w-0"><div class="text-sm font-semibold truncate">${t.original}</div><div class="text-xs text-slate-400">✅ ${t.match.artist} - ${t.match.title}</div></div></div>`).join('');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function renderMissing() {
      const l = document.getElementById('missingList'); if (!l) return;
      if (!lastMatched.missing.length) { l.innerHTML = '<p class="text-center text-slate-500 py-4">🎉 Tutte presenti!</p>'; return; }
      l.innerHTML = lastMatched.missing.map(t => `<div class="bg-red-500/10 border border-red-500/30 rounded p-2 flex items-center gap-2"><i data-lucide="x-circle" class="w-4 h-4 text-red-400"></i><div class="flex-1 min-w-0"><div class="text-sm font-semibold truncate">${t.original}</div><div class="text-xs text-slate-400">❌ Mancante</div></div><a href="https://open.spotify.com/search/${encodeURIComponent(t.original)}" target="_blank" class="text-xs bg-green-600 px-2 py-1 rounded text-white">🔍</a></div>`).join('');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    document.getElementById('tabFound').onclick = () => { document.getElementById('foundList').classList.remove('hidden'); document.getElementById('missingList').classList.add('hidden'); document.getElementById('tabFound').classList.add('active'); document.getElementById('tabMissing').classList.remove('active'); };
    document.getElementById('tabMissing').onclick = () => { document.getElementById('foundList').classList.add('hidden'); document.getElementById('missingList').classList.remove('hidden'); document.getElementById('tabMissing').classList.add('active'); document.getElementById('tabFound').classList.remove('active'); };

    // EXPORT: Tracce presenti → M3U8 per Engine DJ
    document.getElementById('exportPresentM3U8Btn').onclick = () => {
      if (!lastMatched.found.length) { alert('Nessuna traccia presente'); return; }
      let m = '#EXTM3U\n# PLAYLIST: ' + lastMatched.playlistName + ' - PRESENTI\n# Generato da AURA Engine DJ\n# Tracce trovate nella tua libreria\n\n';
      lastMatched.found.forEach(t => { 
        m += `#EXTINF:210,${t.match.artist} - ${t.match.title}\n${t.match.artist} - ${t.match.title}.mp3\n\n`; 
      });
      dl(m, 'AURA_Presenti', 'audio/x-mpegurl');
    };

    // EXPORT: Tracce mancanti → M3U8 per Engine DJ
    document.getElementById('exportMissingM3U8Btn').onclick = () => {
      if (!lastMatched.missing.length) { alert('Nessuna traccia mancante'); return; }
      let m = '#EXTM3U\n# PLAYLIST: ' + lastMatched.playlistName + ' - MANCANTI\n# Generato da AURA Engine DJ\n# Tracce da acquistare/aggiungere\n\n';
      lastMatched.missing.forEach(t => { 
        m += `#EXTINF:210,${t.artist} - ${t.title}\n${t.artist} - ${t.title}.mp3\n\n`; 
      });
      dl(m, 'AURA_Mancanti', 'audio/x-mpegurl');
    };

    // EXPORT: Mancanti come TXT (lista semplice per ricerca)
    document.getElementById('exportMissingTxtBtn').onclick = () => {
      if (!lastMatched.missing.length) { alert('Nessuna traccia mancante'); return; }
      let txt = `TRACCE MANCANTI - ${lastMatched.playlistName}\n`;
      txt += `Generato da AURA Engine DJ il ${new Date().toLocaleDateString('it-IT')}\n`;
      txt += `${'='.repeat(60)}\n\n`;
      lastMatched.missing.forEach((t, i) => { 
        txt += `${i+1}. ${t.artist} - ${t.title}\n`; 
      });
      txt += `\n${'='.repeat(60)}\nTotale: ${lastMatched.missing.length} tracce da acquistare\n`;
      dl(txt, 'AURA_Mancanti_Lista', 'text/plain');
    };

    // EXPORT: Presenti come TXT
    document.getElementById('exportPresentTxtBtn').onclick = () => {
      if (!lastMatched.found.length) { alert('Nessuna traccia presente'); return; }
      let txt = `TRACCE PRESENTI - ${lastMatched.playlistName}\n`;
      txt += `Generato da AURA Engine DJ il ${new Date().toLocaleDateString('it-IT')}\n`;
      txt += `${'='.repeat(60)}\n\n`;
      lastMatched.found.forEach((t, i) => { 
        txt += `${i+1}. ${t.match.artist} - ${t.match.title}\n`; 
      });
      txt += `\n${'='.repeat(60)}\nTotale: ${lastMatched.found.length} tracce nella libreria\n`;
      dl(txt, 'AURA_Presenti_Lista', 'text/plain');
    };

    document.getElementById('exportMissingSpotifyBtn').onclick = () => {
      if (!lastMatched.missing.length) return;
      window.open('https://open.spotify.com/search/' + lastMatched.missing.map(t => encodeURIComponent(t.artist + ' ' + t.title)).join(','), '_blank');
    };

    document.getElementById('createSpotifyPlaylistBtn').onclick = () => {
      if (!lastMatched.missing.length) return;
      window.open('https://open.spotify.com/search/' + lastMatched.missing.map(t => encodeURIComponent(t.artist + ' ' + t.title)).join(','), '_blank');
    };

    function dl(content, filename, mimeType) {
      const b = new Blob([content], { type: mimeType }), u = URL.createObjectURL(b), a = document.createElement('a');
      a.href = u; a.download = filename + '_' + new Date().toISOString().split('T')[0] + (mimeType === 'audio/x-mpegurl' ? '.m3u8' : '.txt');
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
