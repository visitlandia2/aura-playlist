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
          showMsg('❌ ' + err.message, 'error');
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

    // =====================================================
    // NORMALIZZAZIONE SUPER AGGRESSIVA
    // =====================================================
    function normalizeText(text) {
      if (!text) return '';
      let t = text.toString().toLowerCase().trim();
      
      // Rimuovi tutto tra parentesi
      t = t.replace(/\([^)]*\)/g, '');
      t = t.replace(/\[[^\]]*\]/g, '');
      
      // Rimuovi punteggiatura
      t = t.replace(/[''""`´]/g, '');
      t = t.replace(/[~^*!@#$%&]/g, '');
      t = t.replace(/[^\w\s]/g, ' ');
      
      // Gestisci trattini
      t = t.replace(/\s*[-–—]\s*/g, ' ');
      
      // Sostituisci & con "and"
      t = t.replace(/\s*&\s*/g, ' and ');
      
      // Rimuovi feat, featuring, vs, x
      t = t.replace(/\s*(feat\.?|featuring|ft\.?)\s+/gi, ' ');
      t = t.replace(/\s*vs\.?\s+/gi, ' ');
      t = t.replace(/\s*x\s+/gi, ' ');
      
      // Rimuovi TUTTI i suffissi di versione
      t = t.replace(/\s*(radio\s*edit|album\s*(mix|version)|original\s*mix|extended\s*mix|club\s*mix|remix|remastered|remaster|mix|edit|version|live|acoustic|instrumental|single|new|cut)\s*$/gi, ' ');
      t = t.replace(/\s*(2019|2020|2021|2022|2023|2024|2025)\s*$/g, ' ');
      t = t.replace(/\s*(official\s*video|official\s*audio|hq|hd)\s*$/gi, ' ');
      
      // Normalizza spazi
      t = t.replace(/\s+/g, ' ').trim();
      
      return t;
    }

    // =====================================================
    // SIMILARITÀ AGGRESSIVA
    // =====================================================
    function calculateSimilarity(a, b) {
      if (!a || !b) return 0;
      if (a === b) return 100;
      
      const aNorm = normalizeText(a);
      const bNorm = normalizeText(b);
      
      if (aNorm === bNorm) return 100;
      if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) {
        return Math.min(aNorm.length, bNorm.length) / Math.max(aNorm.length, bNorm.length) * 100;
      }
      
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

    // =====================================================
    // PARSER CSV
    // =====================================================
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
      
      const header = parseCSVLine(lines[0]).map(h => {
        let cleaned = h.trim();
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
          cleaned = cleaned.substring(1, cleaned.length - 1);
        }
        return cleaned.toLowerCase();
      });
      
      console.log('Header CSV:', header);
      
      let artistIdx = -1, titleIdx = -1;
      
      header.forEach((h, i) => {
        if (h === "nome dell'artista" || h === 'artist' || h === 'artist name') artistIdx = i;
        if (h === "nome della traccia" || h === 'track name' || h === 'title') titleIdx = i;
      });
      
      if (artistIdx === -1 || titleIdx === -1) {
        if (header.length >= 4) {
          titleIdx = 1;
          artistIdx = 3;
        } else {
          artistIdx = 0;
          titleIdx = 1;
        }
      }
      
      console.log('Colonne: Artist=', artistIdx, 'Title=', titleIdx);
      
      const tracks = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length <= Math.max(artistIdx, titleIdx)) continue;
        
        let artist = cols[artistIdx];
        let title = cols[titleIdx];
        
        if (artist && artist.startsWith('"') && artist.endsWith('"')) {
          artist = artist.substring(1, artist.length - 1);
        }
        if (title && title.startsWith('"') && title.endsWith('"')) {
          title = title.substring(1, title.length - 1);
        }
        
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

    // =====================================================
    // MATCHING SUPER AGGRESSIVO (come Lexicon DJ)
    // =====================================================
    function doMatch(playlistTracks) {
      if (!userLibrary.length) { 
        alert('⚠️ Carica prima la libreria!'); 
        return; 
      }
      
      console.log('🔍 Matching:', playlistTracks.length, 'vs', userLibrary.length);
      
      const found = [];
      const missing = [];
      const usedIndexes = new Set();
      
      // Crea indici per ricerca veloce
      const libraryByTitle = new Map();
      const libraryByArtist = new Map();
      const libraryByNormalized = new Map();
      
      userLibrary.forEach((track, idx) => {
        const titleNorm = normalizeText(track.title);
        const artistNorm = normalizeText(track.artist);
        const combinedNorm = artistNorm + ' ' + titleNorm;
        
        if (!libraryByTitle.has(titleNorm)) libraryByTitle.set(titleNorm, []);
        libraryByTitle.get(titleNorm).push({ track, idx });
        
        if (!libraryByArtist.has(artistNorm)) libraryByArtist.set(artistNorm, []);
        libraryByArtist.get(artistNorm).push({ track, idx });
        
        if (!libraryByNormalized.has(combinedNorm)) libraryByNormalized.set(combinedNorm, []);
        libraryByNormalized.get(combinedNorm).push({ track, idx });
      });
      
      for (let playlistTrack of playlistTracks) {
        let bestMatch = null;
        let bestScore = 0;
        let bestType = '';
        let bestLibIndex = -1;
        
        const plArtistNorm = normalizeText(playlistTrack.artist);
        const plTitleNorm = normalizeText(playlistTrack.title);
        const plCombinedNorm = plArtistNorm + ' ' + plTitleNorm;
        
        // STRATEGIA 1: Match ESATTO combinato
        if (libraryByNormalized.has(plCombinedNorm)) {
          const candidates = libraryByNormalized.get(plCombinedNorm);
          for (const c of candidates) {
            if (!usedIndexes.has(c.idx)) {
              bestMatch = c.track;
              bestScore = 100;
              bestType = 'ESATTO';
              bestLibIndex = c.idx;
              break;
            }
          }
        }
        
        if (bestMatch) {
          found.push({ ...playlistTrack, match: bestMatch, score: 100, matchType: 'ESATTO' });
          usedIndexes.add(bestLibIndex);
          continue;
        }
        
        // STRATEGIA 2: Match titolo esatto, artista simile (>=30%)
        if (libraryByTitle.has(plTitleNorm)) {
          const candidates = libraryByTitle.get(plTitleNorm);
          for (const c of candidates) {
            if (usedIndexes.has(c.idx)) continue;
            const libArtistNorm = normalizeText(c.track.artist);
            const artistSim = calculateSimilarity(plArtistNorm, libArtistNorm);
            if (artistSim >= 30) {
              const score = 85 + (artistSim / 10);
              if (score > bestScore) {
                bestScore = score;
                bestMatch = c.track;
                bestType = 'TITOLO';
                bestLibIndex = c.idx;
              }
            }
          }
        }
        
        // STRATEGIA 3: Match artista esatto, titolo simile (>=50%)
        if (libraryByArtist.has(plArtistNorm)) {
          const candidates = libraryByArtist.get(plArtistNorm);
          for (const c of candidates) {
            if (usedIndexes.has(c.idx)) continue;
            const libTitleNorm = normalizeText(c.track.title);
            const titleSim = calculateSimilarity(plTitleNorm, libTitleNorm);
            if (titleSim >= 50) {
              const score = 80 + (titleSim / 10);
              if (score > bestScore) {
                bestScore = score;
                bestMatch = c.track;
                bestType = 'ARTISTA';
                bestLibIndex = c.idx;
              }
            }
          }
        }
        
        // STRATEGIA 4: Fuzzy match generale (soglia 35%)
        if (bestScore < 70) {
          for (let libIdx = 0; libIdx < userLibrary.length; libIdx++) {
            if (usedIndexes.has(libIdx)) continue;
            
            const libTrack = userLibrary[libIdx];
            const libTitleNorm = normalizeText(libTrack.title);
            const libArtistNorm = normalizeText(libTrack.artist);
            
            const titleSim = calculateSimilarity(plTitleNorm, libTitleNorm);
            const artistSim = calculateSimilarity(plArtistNorm, libArtistNorm);
            
            // Titolo molto simile + artista simile
            if (titleSim >= 60 && artistSim >= 30) {
              const score = (titleSim * 0.6) + (artistSim * 0.4);
              if (score > bestScore) {
                bestScore = score;
                bestMatch = libTrack;
                bestType = 'SIMILE';
                bestLibIndex = libIdx;
              }
            }
            
            // Solo titolo altissimo
            if (titleSim >= 80 && artistSim >= 20) {
              const score = (titleSim * 0.75) + (artistSim * 0.25);
              if (score > bestScore) {
                bestScore = score;
                bestMatch = libTrack;
                bestType = 'TITOLO-ALT';
                bestLibIndex = libIdx;
              }
            }
          }
        }
        
        // Soglia finale: 40% (molto permissiva)
        if (bestScore >= 40 && bestMatch) {
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
      const artist = found.filter(f => f.matchType === 'ARTISTA').length;
      const similar = found.filter(f => f.matchType === 'SIMILE' || f.matchType === 'TITOLO-ALT').length;
      
      console.log(`✅ Risultati: ${found.length}/${playlistTracks.length} (${exact} esatti, ${title} titolo, ${artist} artista, ${similar} simili), ${missing.length} mancanti`);
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

    // =====================================================
    // ESPORTAZIONI CON NOME PLAYLIST
    // =====================================================
    function getExportName(type) {
      return `AURA ${lastMatched.playlistName} - ${type}`;
    }

    document.getElementById('exportPresentM3U8Btn').onclick = () => {
      if (!lastMatched.found.length) { alert('Nessuna traccia presente'); return; }
      let m = '#EXTM3U\n# PLAYLIST: ' + getExportName('Presenti') + '\n# Generato da AURA DJ - ' + new Date().toLocaleDateString('it-IT') + '\n\n';
      lastMatched.found.forEach(t => { m += `#EXTINF:210,${t.match.artist} - ${t.match.title}\n${t.match.artist} - ${t.match.title}.mp3\n\n`; });
      dl(m, getExportName('Presenti'), 'audio/x-mpegurl');
    };

    document.getElementById('exportMissingM3U8Btn').onclick = () => {
      if (!lastMatched.missing.length) { alert('Nessuna traccia mancante'); return; }
      let m = '#EXTM3U\n# PLAYLIST: ' + getExportName('Mancanti') + '\n# Generato da AURA DJ - ' + new Date().toLocaleDateString('it-IT') + '\n\n';
      lastMatched.missing.forEach(t => { m += `#EXTINF:210,${t.artist} - ${t.title}\n${t.artist} - ${t.title}.mp3\n\n`; });
      dl(m, getExportName('Mancanti'), 'audio/x-mpegurl');
    };

    document.getElementById('exportPresentTxtBtn').onclick = () => {
      if (!lastMatched.found.length) { alert('Nessuna traccia presente'); return; }
      let txt = `${getExportName('Presenti')}\nGenerato da AURA DJ il ${new Date().toLocaleDateString('it-IT')}\nTotale: ${lastMatched.found.length} tracce\n${'='.repeat(60)}\n\n`;
      lastMatched.found.forEach((t, i) => { txt += `${i+1}. ${t.match.artist} - ${t.match.title} [${t.matchType} ${t.score}%]\n`; });
      dl(txt, getExportName('Presenti'), 'text/plain');
    };

    document.getElementById('exportMissingTxtBtn').onclick = () => {
      if (!lastMatched.missing.length) { alert('Nessuna traccia mancante'); return; }
      let txt = `${getExportName('Mancanti')}\nGenerato da AURA DJ il ${new Date().toLocaleDateString('it-IT')}\nTotale: ${lastMatched.missing.length} tracce\n${'='.repeat(60)}\n\n`;
      lastMatched.missing.forEach((t, i) => { txt += `${i+1}. ${t.artist} - ${t.title}\n`; });
      dl(txt, getExportName('Mancanti'), 'text/plain');
    };

    function dl(content, filename, mimeType) {
      const b = new Blob([content], { type: mimeType });
      const u = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = u; 
      a.download = filename.replace(/[^a-zA-Z0-9àèéìòùÀÈÉÌÒÙ\s_-]/g, '').replace(/\s+/g, '_') + '_' + new Date().toISOString().split('T')[0] + (mimeType === 'audio/x-mpegurl' ? '.m3u8' : '.txt');
      document.body.appendChild(a); 
      a.click(); 
      document.body.removeChild(a); 
      URL.revokeObjectURL(u);
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
        
        lastMatched.playlistName = file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
        console.log('📁 Nome playlist:', lastMatched.playlistName);
        doMatch(tracks);
      };
      r.readAsText(file);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
