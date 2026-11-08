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
        if (!em || !pw) { showMsg('❌ Inserisci email e password', 'error'); return; }
        
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

    // AUTO-LOGIN
    if (supabase.isLoggedIn()) {
      showDash();
    } else {
      updateAuthUI();
    }

    // CARICA LIBRERIA
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
        } else { alert('Formato non supportato'); return; }
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
        h += `<div class="mb-2"><div class="folder-h bg-dj-bg p-2 rounded cursor-pointer flex justify-between" onclick="this.nextElementSibling.classList.toggle('hidden')"><span> ${n}</span><span class="text-xs text-dj-muted">${tr.length} tracce</span></div><div class="ml-4 mt-1 hidden">`;
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

    // ========================================
    // NORMALIZZAZIONE AVANZATA MULTI-LINGUA
    // ========================================
    function normalizeText(text) {
      if (!text) return '';
      let t = text.toString().toLowerCase();
      
      // Rimuovi punteggiatura speciale
      t = t.replace(/[''""`´]/g, '');
      t = t.replace(/[~^*]/g, ' ');
      t = t.replace(/[\(\)\[\]{}]/g, ' ');
      
      // Gestisci trattini
      t = t.replace(/\s*[-–—]\s*/g, ' ');
      
      // Sostituisci & con "and"
      t = t.replace(/\s*&\s*/g, ' and ');
      
      // Rimuovi feat, featuring, vs, x
      t = t.replace(/\s*(feat\.?|featuring|ft\.?)\s+/gi, ' ');
      t = t.replace(/\s*vs\.?\s+/gi, ' ');
      t = t.replace(/\s*x\s+/gi, ' ');
      
      // Rimuovi termini comuni
      t = t.replace(/\b(radio|album|original|extended|club|remix|remastered|remaster|mix|edit|version|live|acoustic|instrumental|single|new|cut)\b/gi, ' ');
      t = t.replace(/\b(2019|2020|2021|2022|2023|2024|2025)\b/g, ' ');
      t = t.replace(/\b(official|video|audio|hq|hd)\b/gi, ' ');
      
      // Normalizza spazi multipli
      t = t.replace(/\s+/g, ' ').trim();
      
      return t;
    }

    // ========================================
    // SIMILARITÀ AVANZATA
    // ========================================
    function calculateSimilarity(a, b) {
      if (!a || !b) return 0;
      if (a === b) return 100;
      
      const aNorm = normalizeText(a);
      const bNorm = normalizeText(b);
      
      if (aNorm === bNorm) return 100;
      if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) {
        return Math.min(aNorm.length, bNorm.length) / Math.max(aNorm.length, bNorm.length) * 100;
      }
      
      // Confronto parola per parola
      const wordsA = aNorm.split(' ').filter(w => w.length > 1);
      const wordsB = bNorm.split(' ').filter(w => w.length > 1);
      
      if (wordsA.length === 0 || wordsB.length === 0) return 0;
      
      let matches = 0;
      for (let wordA of wordsA) {
        for (let wordB of wordsB) {
          if (wordA === wordB || wordA.includes(wordB) || wordB.includes(wordA)) {
            matches++;
            break;
          }
        }
      }
      
      return (matches / Math.max(wordsA.length, wordsB.length)) * 100;
    }

    // ========================================
    // PARSER CSV INTELLIGENTE (IT/EN)
    // ========================================
    function parseCSVLine(line) {
      const cols = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i+1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          cols.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      cols.push(current.trim());
      return cols;
    }

    function parseSpotifyCSV(content) {
      const lines = content.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return [];
      
      const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
      console.log('📋 Header CSV:', header);
      
      // Cerca colonne in italiano E inglese
      let artistIdx = -1, titleIdx = -1;
      
      header.forEach((h, i) => {
        // Italiano
        if (h === "nome dell'artista") artistIdx = i;
        if (h === "nome della traccia") titleIdx = i;
        
        // Inglese
        if (h === 'artist' || h === 'artist name') artistIdx = i;
        if (h === 'track name' || h === 'title') titleIdx = i;
      });
      
      // Fallback: posizioni standard Exportify
      if (artistIdx === -1 || titleIdx === -1) {
        // Formato: URI(0), Track Name(1), URI Artista(2), Artist Name(3)
        if (header.length >= 4) {
          titleIdx = 1;
          artistIdx = 3;
        } else {
          artistIdx = 0;
          titleIdx = 1;
        }
      }
      
      console.log('📊 Colonne: Artist=', artistIdx, 'Title=', titleIdx);
      
      const tracks = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length <= Math.max(artistIdx, titleIdx)) continue;
        
        const artist = cols[artistIdx];
        const title = cols[titleIdx];
        
        // Salta header duplicati o righe vuote
        if (!artist || !title) continue;
        if (artist.toLowerCase().includes('artista') || title.toLowerCase().includes('traccia')) continue;
        
        tracks.push({ 
          artist: artist, 
          title: title, 
          original: artist + ' - ' + title 
        });
      }
      
      console.log('✅ Parse CSV:', tracks.length, 'tracce trovate');
      if (tracks.length > 0) console.log('Esempio:', tracks[0]);
      return tracks;
    }

    // ========================================
    // MATCHING SUPER INTELLIGENTE
    // ========================================
    function doMatch(playlistTracks) {
      if (!userLibrary.length) { 
        alert('⚠️ Carica prima la libreria!'); 
        return; 
      }
      
      console.log('🔍 Matching:', playlistTracks.length, 'vs', userLibrary.length);
      
      const found = [];
      const missing = [];
      const usedIndexes = new Set();
      
      for (let playlistTrack of playlistTracks) {
        let bestMatch = null;
        let bestScore = 0;
        let bestType = '';
        let bestLibIndex = -1;
        
        // Strategia 1: Match ESATTO normalizzato
        const plArtistNorm = normalizeText(playlistTrack.artist);
        const plTitleNorm = normalizeText(playlistTrack.title);
        
        for (let libIdx = 0; libIdx < userLibrary.length; libIdx++) {
          if (usedIndexes.has(libIdx)) continue;
          
          const libTrack = userLibrary[libIdx];
          const libArtistNorm = normalizeText(libTrack.artist);
          const libTitleNorm = normalizeText(libTrack.title);
          
          // Match perfetto
          if (plArtistNorm === libArtistNorm && plTitleNorm === libTitleNorm) {
            bestMatch = libTrack;
            bestScore = 100;
            bestType = 'ESATTO';
            bestLibIndex = libIdx;
            break;
          }
          
          // Match titolo perfetto, artista simile
          if (plTitleNorm === libTitleNorm) {
            const artistSim = calculateSimilarity(playlistTrack.artist, libTrack.artist);
            if (artistSim >= 60) {
              const score = 90 + (artistSim / 10);
              if (score > bestScore) {
                bestScore = score;
                bestMatch = libTrack;
                bestType = 'TITOLO';
                bestLibIndex = libIdx;
              }
            }
          }
          
          // Match artista perfetto, titolo simile
          if (plArtistNorm === libArtistNorm) {
            const titleSim = calculateSimilarity(playlistTrack.title, libTrack.title);
            if (titleSim >= 70) {
              const score = 85 + (titleSim / 10);
              if (score > bestScore) {
                bestScore = score;
                bestMatch = libTrack;
                bestType = 'ARTISTA';
                bestLibIndex = libIdx;
              }
            }
          }
          
          // Match fuzzy entrambi
          const titleSim = calculateSimilarity(playlistTrack.title, libTrack.title);
          const artistSim = calculateSimilarity(playlistTrack.artist, libTrack.artist);
          
          if (titleSim >= 80 && artistSim >= 60) {
            const score = (titleSim * 0.6) + (artistSim * 0.4);
            if (score > bestScore) {
              bestScore = score;
              bestMatch = libTrack;
              bestType = 'SIMILE';
              bestLibIndex = libIdx;
            }
          }
          
          // Match solo titolo molto alto
          if (titleSim >= 90 && artistSim >= 40) {
            const score = (titleSim * 0.75) + (artistSim * 0.25);
            if (score > bestScore) {
              bestScore = score;
              bestMatch = libTrack;
              bestType = 'TITOLO-ALT';
              bestLibIndex = libIdx;
            }
          }
        }
        
        // Soglia: 65%
        if (bestScore >= 65 && bestMatch) {
          found.push({ 
            ...playlistTrack, 
            match: bestMatch, 
            score: Math.round(bestScore),
            matchType: bestType
          });
          usedIndexes.add(bestLibIndex);
        } else {
          missing.push(playlistTrack);
        }
      }
      
      lastMatched = { found, missing, playlistName: lastMatched.playlistName };
      document.getElementById('matcherResults').classList.remove('hidden');
      document.getElementById('mTotal').innerText = playlistTracks.length;
      document.getElementById('mFound').innerText = found.length;
      document.getElementById('mMissing').innerText = missing.length;
      renderFound(); 
      renderMissing();
      
      const exact = found.filter(f => f.matchType === 'ESATTO').length;
      const title = found.filter(f => f.matchType === 'TITOLO').length;
      const similar = found.filter(f => f.matchType === 'SIMILE' || f.matchType === 'TITOLO-ALT').length;
      
      console.log(`✅ Risultati: ${found.length}/${playlistTracks.length} (${exact} esatti, ${title} titolo, ${similar} simili), ${missing.length} mancanti`);
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
      let m = '#EXTM3U\n# PLAYLIST: ' + lastMatched.playlistName + ' - PRESENTI\n# Generato da AURA DJ - ' + new Date().toLocaleDateString('it-IT') + '\n\n';
      lastMatched.found.forEach(t => { m += `#EXTINF:210,${t.match.artist} - ${t.match.title}\n${t.match.artist} - ${t.match.title}.mp3\n\n`; });
      dl(m, 'AURA_Presenti', 'audio/x-mpegurl');
    };

    document.getElementById('exportMissingM3U8Btn').onclick = () => {
      if (!lastMatched.missing.length) { alert('Nessuna traccia mancante'); return; }
      let m = '#EXTM3U\n# PLAYLIST: ' + lastMatched.playlistName + ' - MANCANTI\n# Generato da AURA DJ - ' + new Date().toLocaleDateString('it-IT') + '\n\n';
      lastMatched.missing.forEach(t => { m += `#EXTINF:210,${t.artist} - ${t.title}\n${t.artist} - ${t.title}.mp3\n\n`; });
      dl(m, 'AURA_Mancanti', 'audio/x-mpegurl');
    };

    document.getElementById('exportPresentTxtBtn').onclick = () => {
      if (!lastMatched.found.length) { alert('Nessuna traccia presente'); return; }
      let txt = `TRACCE PRESENTI - ${lastMatched.playlistName}\nGenerato da AURA DJ il ${new Date().toLocaleDateString('it-IT')}\nTotale: ${lastMatched.found.length} tracce\n${'='.repeat(60)}\n\n`;
      lastMatched.found.forEach((t, i) => { txt += `${i+1}. ${t.match.artist} - ${t.match.title} [${t.matchType} ${t.score}%]\n`; });
      dl(txt, 'AURA_Presenti', 'text/plain');
    };

    document.getElementById('exportMissingTxtBtn').onclick = () => {
      if (!lastMatched.missing.length) { alert('Nessuna traccia mancante'); return; }
      let txt = `TRACCE MANCANTI - ${lastMatched.playlistName}\nGenerato da AURA DJ il ${new Date().toLocaleDateString('it-IT')}\nTotale: ${lastMatched.missing.length} tracce\n${'='.repeat(60)}\n\n`;
      lastMatched.missing.forEach((t, i) => { txt += `${i+1}. ${t.artist} - ${t.title}\n`; });
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
        let tracks = [];
        
        if (file.name.endsWith('.csv')) {
          tracks = parseSpotifyCSV(e.target.result);
        } else {
          // TXT o M3U8
          const lines = e.target.result.split(/\r?\n/);
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
        
        if (!tracks.length) { 
          alert('Nessuna traccia trovata. Verifica il formato del file.'); 
          document.getElementById('matcherDropText').innerText = 'Trascina qui il file .csv, .m3u8 o .txt'; 
          return; 
        }
        
        lastMatched.playlistName = file.name.replace(/\.[^.]+$/, '');
        doMatch(tracks);
      };
      r.readAsText(file);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
