(function() {
  'use strict';

  function init() {
    if (typeof lucide !== 'undefined') lucide.createIcons();

    let authMode = 'login';
    let userLibrary = [];
    let playlistStructure = {};
    let selectedTracks = new Set();
    let lastMatched = { found: [], missing: [], playlistName: 'Playlist' };

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

    // LIBRERIA
    const dz = document.getElementById('dropZone');
    const fi = document.getElementById('fileInput');
    if (dz && fi) {
      ['dragenter','dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('border-purple-500'); }));
      ['dragleave','drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('border-purple-500'); }));
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
        } else { alert('Formato non supportato. Usa .m3u8 o .xml'); return; }
        userLibrary = tracks; playlistStructure = pls;
        document.getElementById('dropText').innerText = 'Trascina qui il file .m3u8 o .xml';
        document.getElementById('resultArea').classList.remove('hidden');
        document.getElementById('resultText').innerText = `✅ ${tracks.length} tracce in ${Object.keys(pls).length} playlist`;
        renderTree(); saveCloud();
      };
      r.readAsText(file);
    }

    function renderTree() {
      const t = document.getElementById('playlistTree'); if (!t) return;
      if (!Object.keys(playlistStructure).length) { t.innerHTML = '<p class="text-center text-dj-muted py-8">Nessuna playlist</p>'; return; }
      let h = '';
      for (let n in playlistStructure) {
        const tr = playlistStructure[n];
        h += `<div class="mb-2"><div class="folder-h bg-dj-bg p-2 rounded cursor-pointer flex justify-between" onclick="this.nextElementSibling.classList.toggle('hidden')"><span>📁 ${n}</span><span class="text-xs text-dj-muted">${tr.length} tracce</span></div><div class="ml-4 mt-1 hidden">`;
        tr.forEach((tk, i) => { h += `<label class="flex items-center gap-2 p-1 hover:bg-dj-card rounded cursor-pointer"><input type="checkbox" class="tcb" data-id="${n}-${i}" onchange="updSel()"> <span class="text-sm">${tk.artist} - ${tk.title}</span></label>`; });
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

    // NORMALIZZAZIONE
    function norm(t) { 
      if (!t) return ''; 
      return t.toString()
        .toLowerCase()
        .replace(/[~"'`´^\(\)\[\]{}]/g, ' ')
        .replace(/\s*[-–—]\s*/g, ' ')
        .replace(/\s*ft\.?\s+/gi, ' ')
        .replace(/\s*feat\.?\s+/gi, ' ')
        .replace(/\s*featuring\s+/gi, ' ')
        .replace(/\s*vs\.?\s+/gi, ' ')
        .replace(/\s*x\s+/gi, ' ')
        .replace(/\b(radio\s*edit|album\s*version|original\s*mix|extended\s*mix|club\s*mix|remix|remastered|remaster|2019|2020|2021|2022|2023|2024|2025|official|video|audio|hq|hd|live|acoustic|instrumental)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim(); 
    }

    // SIMILARITÀ
    function sim(a, b) {
      if (!a || !b) return 0;
      if (a === b) return 100;
      if (a.includes(b) || b.includes(a)) {
        return (Math.min(a.length, b.length) / Math.max(a.length, b.length)) * 100;
      }
      const w1 = a.split(' ').filter(w => w.length > 1);
      const w2 = b.split(' ').filter(w => w.length > 1);
      if (w1.length === 0 || w2.length === 0) return 0;
      let matches = 0;
      for (let word1 of w1) {
        for (let word2 of w2) {
          if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
            matches++;
            break;
          }
        }
      }
      return (matches / Math.max(w1.length, w2.length)) * 100;
    }

    // MATCHING
    function doMatch(spTracks) {
      if (!userLibrary.length) { 
        alert('⚠️ Carica prima la libreria!'); 
        return; 
      }
      
      console.log('🔍 Inizio matching:', spTracks.length, 'tracce da confrontare con', userLibrary.length, 'tracce in libreria');
      
      const found = [];
      const missing = [];
      
      // Indice per ricerca veloce
      const libraryIndex = new Map();
      userLibrary.forEach((track, index) => {
        const key = norm(track.artist) + '|' + norm(track.title);
        libraryIndex.set(key, { track, index });
      });
      
      for (let sp of spTracks) {
        const spArtistNorm = norm(sp.artist);
        const spTitleNorm = norm(sp.title);
        const spKey = spArtistNorm + '|' + spTitleNorm;
        
        // 1. Match ESATTO
        if (libraryIndex.has(spKey)) {
          const match = libraryIndex.get(spKey).track;
          found.push({ 
            ...sp, 
            match: match, 
            score: 100,
            matchType: 'ESATTO'
          });
          continue;
        }
        
        // 2. Match per TITOLO
        let bestMatch = null;
        let bestScore = 0;
        let bestType = '';
        
        for (let lib of userLibrary) {
          const libArtistNorm = norm(lib.artist);
          const libTitleNorm = norm(lib.title);
          
          // Titolo identico
          if (spTitleNorm === libTitleNorm) {
            const artistSim = sim(spArtistNorm, libArtistNorm);
            if (artistSim >= 70) {
              const totalScore = 85 + (artistSim / 10);
              if (totalScore > bestScore) {
                bestScore = totalScore;
                bestMatch = lib;
                bestType = 'TITOLO';
              }
            }
          }
          
          // Titolo simile
          const titleSim = sim(spTitleNorm, libTitleNorm);
          const artistSim = sim(spArtistNorm, libArtistNorm);
          
          if (titleSim >= 90 && artistSim >= 60) {
            const totalScore = (titleSim * 0.6) + (artistSim * 0.4);
            if (totalScore > bestScore) {
              bestScore = totalScore;
              bestMatch = lib;
              bestType = 'SIMILE';
            }
          }
        }
        
        if (bestScore >= 70 && bestMatch) {
          found.push({ 
            ...sp, 
            match: bestMatch, 
            score: Math.round(bestScore),
            matchType: bestType
          });
        } else {
          missing.push(sp);
        }
      }
      
      lastMatched = { found, missing, playlistName: lastMatched.playlistName };
      document.getElementById('matcherResults').classList.remove('hidden');
      document.getElementById('mTotal').innerText = spTracks.length;
      document.getElementById('mFound').innerText = found.length;
      document.getElementById('mMissing').innerText = missing.length;
      renderFound(); 
      renderMissing();
      
      console.log(`✅ Match completato: ${found.length} trovate (${found.filter(f => f.matchType === 'ESATTO').length} esatte, ${found.filter(f => f.matchType === 'TITOLO').length} titolo, ${found.filter(f => f.matchType === 'SIMILE').length} simili), ${missing.length} mancanti`);
    }

    function renderFound() {
      const l = document.getElementById('foundList'); if (!l) return;
      if (!lastMatched.found.length) { l.innerHTML = '<p class="text-center text-dj-muted py-4">Nessun match</p>'; return; }
      l.innerHTML = lastMatched.found.map(t => `<div class="bg-green-500/10 border border-green-500/30 rounded p-2 flex items-center gap-2"><i data-lucide="check-circle" class="w-4 h-4 text-green-400"></i><div class="flex-1 min-w-0"><div class="text-sm font-semibold truncate">${t.original}</div><div class="text-xs text-dj-muted">✅ ${t.match.artist} - ${t.match.title} <span class="text-purple-400">[${t.matchType} ${t.score}%]</span></div></div></div>`).join('');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function renderMissing() {
      const l = document.getElementById('missingList'); if (!l) return;
      if (!lastMatched.missing.length) { l.innerHTML = '<p class="text-center text-dj-muted py-4">🎉 Tutte presenti!</p>'; return; }
      l.innerHTML = lastMatched.missing.map(t => `<div class="bg-red-500/10 border border-red-500/30 rounded p-2 flex items-center gap-2"><i data-lucide="x-circle" class="w-4 h-4 text-red-400"></i><div class="flex-1 min-w-0"><div class="text-sm font-semibold truncate">${t.original}</div><div class="text-xs text-dj-muted">❌ Mancante</div></div></div>`).join('');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    document.getElementById('tabFound').onclick = () => { document.getElementById('foundList').classList.remove('hidden'); document.getElementById('missingList').classList.add('hidden'); document.getElementById('tabFound').classList.add('active'); document.getElementById('tabMissing').classList.remove('active'); };
    document.getElementById('tabMissing').onclick = () => { document.getElementById('foundList').classList.add('hidden'); document.getElementById('missingList').classList.remove('hidden'); document.getElementById('tabMissing').classList.add('active'); document.getElementById('tabFound').classList.remove('active'); };

    // ESPORTAZIONI
    document.getElementById('exportPresentM3U8Btn').onclick = () => {
      if (!lastMatched.found.length) { alert('Nessuna traccia presente'); return; }
      let m = '#EXTM3U\n# PLAYLIST: ' + lastMatched.playlistName + ' - PRESENTI\n# Generato da AURA DJ\n\n';
      lastMatched.found.forEach(t => { m += `#EXTINF:210,${t.match.artist} - ${t.match.title}\n${t.match.artist} - ${t.match.title}.mp3\n\n`; });
      dl(m, 'AURA_Presenti', 'audio/x-mpegurl');
    };

    document.getElementById('exportMissingM3U8Btn').onclick = () => {
      if (!lastMatched.missing.length) { alert('Nessuna traccia mancante'); return; }
      let m = '#EXTM3U\n# PLAYLIST: ' + lastMatched.playlistName + ' - MANCANTI\n# Generato da AURA DJ\n\n';
      lastMatched.missing.forEach(t => { m += `#EXTINF:210,${t.artist} - ${t.title}\n${t.artist} - ${t.title}.mp3\n\n`; });
      dl(m, 'AURA_Mancanti', 'audio/x-mpegurl');
    };

    document.getElementById('exportPresentTxtBtn').onclick = () => {
      if (!lastMatched.found.length) { alert('Nessuna traccia presente'); return; }
      let txt = `TRACCE PRESENTI - ${lastMatched.playlistName}\nGenerato da AURA DJ il ${new Date().toLocaleDateString('it-IT')}\n${'='.repeat(60)}\n\n`;
      lastMatched.found.forEach((t, i) => { txt += `${i+1}. ${t.match.artist} - ${t.match.title} [${t.matchType}]\n`; });
      txt += `\n${'='.repeat(60)}\nTotale: ${lastMatched.found.length} tracce\n`;
      dl(txt, 'AURA_Presenti', 'text/plain');
    };

    document.getElementById('exportMissingTxtBtn').onclick = () => {
      if (!lastMatched.missing.length) { alert('Nessuna traccia mancante'); return; }
      let txt = `TRACCE MANCANTI - ${lastMatched.playlistName}\nGenerato da AURA DJ il ${new Date().toLocaleDateString('it-IT')}\n${'='.repeat(60)}\n\n`;
      lastMatched.missing.forEach((t, i) => { txt += `${i+1}. ${t.artist} - ${t.title}\n`; });
      txt += `\n${'='.repeat(60)}\nTotale: ${lastMatched.missing.length} tracce da acquistare\n`;
      dl(txt, 'AURA_Mancanti', 'text/plain');
    };

    function dl(content, filename, mimeType) {
      const b = new Blob([content], { type: mimeType }), u = URL.createObjectURL(b), a = document.createElement('a');
      a.href = u; a.download = filename + '_' + new Date().toISOString().split('T')[0] + (mimeType === 'audio/x-mpegurl' ? '.m3u8' : '.txt');
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u);
    }

    // CARICA FILE PLAYLIST
    const mdz = document.getElementById('matcherDropZone'), mfi = document.getElementById('matcherFileInput');
    if (mdz && mfi) {
      ['dragenter','dragover'].forEach(ev => mdz.addEventListener(ev, e => { e.preventDefault(); mdz.classList.add('border-purple-500'); }));
      ['dragleave','drop'].forEach(ev => mdz.addEventListener(ev, e => { e.preventDefault(); mdz.classList.remove('border-purple-500'); }));
      mdz.addEventListener('drop', e => { if (e.dataTransfer.files.length) handleMatcherFile(e.dataTransfer.files[0]); });
      mfi.onchange = e => { if (e.target.files.length) handleMatcherFile(e.target.files[0]); };
    }

    function handleMatcherFile(file) {
      document.getElementById('matcherDropText').innerText = 'Analisi...';
      const r = new FileReader();
      r.onload = e => {
        const tracks = parseFile(e.target.result, file.name);
        console.log('📄 File caricato:', file.name, '-', tracks.length, 'tracce trovate');
        if (tracks.length > 0) {
          console.log('Prima traccia:', tracks[0]);
        }
        if (!tracks.length) { alert('Nessuna traccia trovata. Verifica il formato del file.'); document.getElementById('matcherDropText').innerText = 'Trascina qui il file .m3u8, .txt o .csv'; return; }
        lastMatched.playlistName = file.name.replace(/\.[^.]+$/, '');
        doMatch(tracks);
      };
      r.readAsText(file);
    }

    function parseFile(content, filename) {
      const tracks = [];
      const lines = content.split(/\r?\n/);
      
      if (filename.endsWith('.csv')) {
        // Formato Exportify: Track URI, Track Name, Artist, Album, ...
        // Oppure: Artist, Title, ...
        const header = lines[0].toLowerCase();
        console.log('📋 Header CSV:', header);
        
        // Rileva il formato
        let artistCol = -1, titleCol = -1;
        const cols = header.split(',').map(c => c.trim());
        
        if (header.includes('artist') && header.includes('track name')) {
          // Formato Exportify
          artistCol = cols.findIndex(c => c === 'artist');
          titleCol = cols.findIndex(c => c === 'track name');
        } else if (header.includes('artist') && header.includes('title')) {
          // Formato standard
          artistCol = cols.findIndex(c => c === 'artist');
          titleCol = cols.findIndex(c => c === 'title');
        } else {
          // Assumi Artist, Title
          artistCol = 0;
          titleCol = 1;
        }
        
        console.log('📊 Colonne rilevate: Artist=', artistCol, 'Title=', titleCol);
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          // Parsa CSV rispettando le virgolette
          const cols = [];
          let current = '';
          let inQuotes = false;
          for (let char of line) {
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              cols.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          cols.push(current.trim());
          
          if (artistCol >= 0 && titleCol >= 0 && cols[artistCol] && cols[titleCol]) {
            const artist = cols[artistCol];
            const title = cols[titleCol];
            tracks.push({ artist, title, original: artist + ' - ' + title });
          }
        }
      } else {
        // TXT o M3U8
        for (let line of lines) {
          line = line.trim();
          if (!line || line.startsWith('#')) continue;
          const parts = line.split(' - ').map(p => p.trim()).filter(p => p.length > 0);
          if (parts.length < 2) continue;
          let artist = parts[0], title = parts[1];
          if (parts.length > 2) { artist = parts[parts.length - 1]; title = parts.slice(0, -1).join(' - '); }
          if (artist && title) tracks.push({ artist, title, original: line });
        }
      }
      
      return tracks;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
