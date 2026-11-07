(function() {
  'use strict';
  
  function init() {
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
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

    function showMsg(t, type) {
      type = type || 'error';
      const m = document.getElementById('authMessage');
      if (!m) return;
      m.classList.remove('hidden');
      if (type === 'error') {
        m.className = 'mb-4 p-3 rounded-lg text-sm bg-red-500/20 border border-red-500 text-red-300';
      } else {
        m.className = 'mb-4 p-3 rounded-lg text-sm bg-green-500/20 border border-green-500 text-green-300';
      }
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
        e.stopPropagation();
        
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

    const forgotBtn = document.getElementById('forgotBtn');
    if (forgotBtn) {
      forgotBtn.addEventListener('click', function(e) {
        e.preventDefault();
        const em = document.getElementById('email').value.trim();
        if (!em) { alert('Inserisci prima la email'); return; }
        alert('Per resettare la password, crea un nuovo account.');
      });
    }

    function showDash() {
      const u = supabase.getUser();
      const ls = document.getElementById('loginScreen');
      const ds = document.getElementById('dashboardScreen');
      if (ls) ls.classList.add('hidden');
      if (ds) ds.classList.remove('hidden');
      if (u && u.email) {
        const ue = document.getElementById('userEmail');
        if (ue) ue.innerText = u.email;
      }
      loadSaved();
    }

    window.logout = function() {
      supabase.signOut();
      const ls = document.getElementById('loginScreen');
      const ds = document.getElementById('dashboardScreen');
      if (ds) ds.classList.add('hidden');
      if (ls) ls.classList.remove('hidden');
      const em = document.getElementById('email');
      const pw = document.getElementById('password');
      if (em) em.value = '';
      if (pw) pw.value = '';
    };

    if (supabase.isLoggedIn()) showDash();
    else updateAuthUI();

    const dz = document.getElementById('dropZone');
    const fi = document.getElementById('fileInput');
    if (dz && fi) {
      ['dragenter','dragover'].forEach(function(ev) {
        dz.addEventListener(ev, function(e) { e.preventDefault(); dz.classList.add('border-aura-gold'); });
      });
      ['dragleave','drop'].forEach(function(ev) {
        dz.addEventListener(ev, function(e) { e.preventDefault(); dz.classList.remove('border-aura-gold'); });
      });
      dz.addEventListener('drop', function(e) { if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); });
      fi.onchange = function(e) { if (e.target.files.length) handleFile(e.target.files[0]); };
    }

    function handleFile(file) {
      const dt = document.getElementById('dropText');
      if (dt) dt.innerText = 'Analisi...';
      const r = new FileReader();
      r.onload = function(e) {
        const c = e.target.result;
        let tracks = [], pls = {};
        if (file.name.endsWith('.xml')) {
          const p = new DOMParser();
          const x = p.parseFromString(c, 'text/xml');
          tracks = Array.from(x.getElementsByTagName('TRACK')).map(function(n) {
            return {
              artist: n.getAttribute('Artist') || 'Unknown',
              title: n.getAttribute('Name') || 'Unknown',
              bpm: n.getAttribute('BPM') || '?',
              key: getCamelot(n.getAttribute('Key') || '?'),
              energy: getEnergy(n.getAttribute('BPM'))
            };
          });
          pls = { 'Collection': tracks };
        } else if (file.name.endsWith('.m3u8') || file.name.endsWith('.m3u')) {
          const lines = c.split(/\r?\n/);
          let cp = 'Collection', ct = '', ca = '';
          pls[cp] = [];
          for (let i = 0; i < lines.length; i++) {
            let l = lines[i].trim();
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
        if (dt) dt.innerText = 'Trascina qui il file';
        const ra = document.getElementById('resultArea');
        const rt = document.getElementById('resultText');
        if (ra) ra.classList.remove('hidden');
        if (rt) rt.innerText = '✅ ' + tracks.length + ' tracce in ' + Object.keys(pls).length + ' playlist';
        renderTree();
        saveCloud();
      };
      r.readAsText(file);
    }

    function renderTree() {
      const t = document.getElementById('playlistTree');
      if (!t) return;
      if (!Object.keys(playlistStructure).length) {
        t.innerHTML = '<p class="text-center text-slate-500 py-8">Nessuna playlist</p>';
        return;
      }
      let h = '';
      for (let n in playlistStructure) {
        const tr = playlistStructure[n];
        h += '<div class="mb-2"><div class="folder-h bg-slate-800 p-2 rounded cursor-pointer flex justify-between" onclick="this.nextElementSibling.classList.toggle(\'hidden\')"><span>📁 ' + n + '</span><span class="text-xs text-slate-400">' + tr.length + ' tracce</span></div><div class="ml-4 mt-1 hidden">';
        for (let i = 0; i < tr.length; i++) {
          const tk = tr[i];
          h += '<label class="flex items-center gap-2 p-1 hover:bg-slate-800 rounded cursor-pointer"><input type="checkbox" class="tcb" data-id="' + n + '-' + i + '" onchange="updSel()"> <span class="text-sm">' + tk.artist + ' - ' + tk.title + '</span></label>';
        }
        h += '</div></div>';
      }
      t.innerHTML = h;
    }

    window.updSel = function() {
      selectedTracks.clear();
      const cbs = document.querySelectorAll('.tcb:checked');
      for (let i = 0; i < cbs.length; i++) selectedTracks.add(cbs[i].dataset.id);
      const sc = document.getElementById('selectedCount');
      if (sc) sc.innerText = selectedTracks.size;
    };

    const expandAllBtn = document.getElementById('expandAllBtn');
    if (expandAllBtn) expandAllBtn.onclick = function() {
      const divs = document.querySelectorAll('.folder-h+div');
      for (let i = 0; i < divs.length; i++) divs[i].classList.remove('hidden');
    };
    const collapseAllBtn = document.getElementById('collapseAllBtn');
    if (collapseAllBtn) collapseAllBtn.onclick = function() {
      const divs = document.querySelectorAll('.folder-h+div');
      for (let i = 0; i < divs.length; i++) divs[i].classList.add('hidden');
    };
    const selectAllBtn = document.getElementById('selectAllBtn');
    if (selectAllBtn) selectAllBtn.onclick = function() {
      const cbs = document.querySelectorAll('.tcb');
      for (let i = 0; i < cbs.length; i++) cbs[i].checked = true;
      updSel();
    };

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
    function norm(t, strict) {
      if (!t) return '';
      let n = t.toString().toLowerCase().replace(/[~"'`´^]/g, ' ').replace(/\s*-\s*/g, ' ').replace(/\s*[\(\)\[\]]/g, ' ').replace(/\s*(feat\.?|ft\.?|featuring|vs\.?| x )\s+[^,;]+/gi, ' ');
      if (!strict) for (let i = 0; i < NOISE.length; i++) n = n.replace(new RegExp('\\b' + NOISE[i] + '\\b', 'gi'), ' ');
      return n.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    }
    function sim(a, b) {
      if (a === b) return 100;
      if (!a || !b) return 0;
      if (a.includes(b) || b.includes(a)) return (Math.min(a.length, b.length) / Math.max(a.length, b.length)) * 100;
      const w1 = a.split(' ').filter(function(w) { return w.length > 1; });
      const w2 = b.split(' ').filter(function(w) { return w.length > 1; });
      let c = 0;
      for (let i = 0; i < w1.length; i++) for (let j = 0; j < w2.length; j++) if (w1[i] === w2[j]) { c++; break; }
      return (c / Math.max(w1.length, w2.length)) * 100;
    }

    async function fetchFromWorker(endpoint, options) {
      options = options || {};
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

    const fetchSpotifyBtn = document.getElementById('fetchSpotifyBtn');
    if (fetchSpotifyBtn) {
      fetchSpotifyBtn.onclick = async function() {
        const link = document.getElementById('spotifyLink').value.trim();
        const ld = document.getElementById('spotifyLoading');
        const er = document.getElementById('spotifyError');
        if (!link) { alert('Incolla il link Spotify'); return; }
        const m = link.match(/playlist\/([a-zA-Z0-9]+)/);
        if (!m) { alert('Link non valido'); return; }
        const pid = m[1];
        if (ld) ld.classList.remove('hidden');
        if (er) er.classList.add('hidden');
        try {
          const tokRes = await fetchFromWorker('/token', { method: 'POST' });
          const tok = await tokRes.json();
          if (!tok.access_token) throw new Error('Token non ricevuto');
          const trRes = await fetchFromWorker('/playlist/' + pid, { headers: { 'Authorization': 'Bearer ' + tok.access_token } });
          const data = await trRes.json();
          const tracks = data.items.map(function(i) {
            const t = i.track;
            if (!t) return null;
            return { artist: t.artists.map(function(a) { return a.name; }).join(', '), title: t.name, original: t.artists.map(function(a) { return a.name; }).join(', ') + ' - ' + t.name };
          }).filter(function(t) { return t; });
          if (!tracks.length) throw new Error('Nessuna traccia');
          lastMatched.spotifyTracks = tracks;
          doMatch(tracks);
        } catch (e) {
          if (er) {
            er.classList.remove('hidden');
            er.innerHTML = '❌ ' + e.message + '<br><div class="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs"><strong>💡 Alternativa:</strong> Usa <a href="https://www.tunemymusic.com/it/" target="_blank" class="underline text-aura-gold">TuneMyMusic</a> per esportare in CSV</div>';
          }
        } finally { if (ld) ld.classList.add('hidden'); }
      };
    }

    const mdz = document.getElementById('matcherDropZone');
    const mfi = document.getElementById('matcherFileInput');
    if (mdz && mfi) {
      ['dragenter','dragover'].forEach(function(ev) {
        mdz.addEventListener(ev, function(e) { e.preventDefault(); mdz.classList.add('border-aura-gold'); });
      });
      ['dragleave','drop'].forEach(function(ev) {
        mdz.addEventListener(ev, function(e) { e.preventDefault(); mdz.classList.remove('border-aura-gold'); });
      });
      mdz.addEventListener('drop', function(e) { if (e.dataTransfer.files.length) handleMatcherFile(e.dataTransfer.files[0]); });
      mfi.onchange = function(e) { if (e.target.files.length) handleMatcherFile(e.target.files[0]); };
    }

    function handleMatcherFile(file) {
      const dt = document.getElementById('matcherDropText');
      if (dt) dt.innerText = 'Analisi...';
      const r = new FileReader();
      r.onload = function(e) {
        const tracks = parseFile(e.target.result, file.name);
        if (!tracks.length) { alert('Nessuna traccia'); if (dt) dt.innerText = 'Trascina qui il file'; return; }
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
          const cols = lines[i].split(',').map(function(c) { return c.replace(/^"|"$/g, '').trim(); });
          if (cols.length >= 2 && cols[0] && cols[1]) tracks.push({ artist: cols[0], title: cols[1], original: cols[0] + ' - ' + cols[1] });
        }
      } else {
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          let line = lines[i].trim();
          if (!line || line.startsWith('#')) continue;
          const parts = line.split(' - ').map(function(p) { return p.trim(); }).filter(function(p) { return p.length > 0; });
          if (parts.length < 2) continue;
          let artist, title;
          if (parts.length === 2) {
            if (parts[0].split(' ').length <= parts[1].split(' ').length) { artist = parts[0]; title = parts[1]; }
            else { title = parts[0]; artist = parts[1]; }
          } else { artist = parts[parts.length - 1]; title = parts.slice(0, -1).join(' - '); }
          if (artist && title) tracks.push({ artist: artist, title: title, original: line });
        }
      }
      return tracks;
    }

    function doMatch(spTracks) {
      if (!userLibrary.length) { alert('⚠️ Carica prima la libreria!'); return; }
      const found = [], missing = [];
      for (let i = 0; i < spTracks.length; i++) {
        const sp = spTracks[i];
        let best = null, bs = { t: 0, a: 0 };
        for (let j = 0; j < userLibrary.length; j++) {
          const lib = userLibrary[j];
          const as = sim(norm(sp.artist, true), norm(lib.artist, true));
          const ts = sim(norm(sp.title, false), norm(lib.title, false));
          const tot = as >= 90 ? as * 0.8 + ts * 0.2 : as * 0.6 + ts * 0.4;
          if (tot > bs.t) { bs = { t: tot, a: as }; best = lib; }
        }
        if (bs.a >= 85) found.push({ artist: sp.artist, title: sp.title, original: sp.original, match: best, score: bs });
        else missing.push(sp);
      }
      lastMatched = { found: found, missing: missing, spotifyTracks: spTracks };
      const mr = document.getElementById('matcherResults');
      if (mr) mr.classList.remove('hidden');
      const mt = document.getElementById('mTotal');
      const mf = document.getElementById('mFound');
      const mm = document.getElementById('mMissing');
      if (mt) mt.innerText = spTracks.length;
      if (mf) mf.innerText = found.length;
      if (mm) mm.innerText = missing.length;
      renderFound();
      renderMissing();
    }

    function renderFound() {
      const l = document.getElementById('foundList');
      if (!l) return;
      if (!lastMatched.found.length) { l.innerHTML = '<p class="text-center text-slate-500 py-4">Nessun match</p>'; return; }
      l.innerHTML = lastMatched.found.map(function(t) {
        return '<div class="bg-green-500/10 border border-green-500/30 rounded p-2 flex items-center gap-2"><i data-lucide="check-circle" class="w-4 h-4 text-green-400"></i><div class="flex-1 min-w-0"><div class="text-sm font-semibold truncate">' + t.original + '</div><div class="text-xs text-slate-400">✅ ' + t.match.artist + ' - ' + t.match.title + '</div></div></div>';
      }).join('');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function renderMissing() {
      const l = document.getElementById('missingList');
      if (!l) return;
      if (!lastMatched.missing.length) { l.innerHTML = '<p class="text-center text-slate-500 py-4">🎉 Tutte presenti!</p>'; return; }
      l.innerHTML = lastMatched.missing.map(function(t) {
        return '<div class="bg-red-500/10 border border-red-500/30 rounded p-2 flex items-center gap-2"><i data-lucide="x-circle" class="w-4 h-4 text-red-400"></i><div class="flex-1 min-w-0"><div class="text-sm font-semibold truncate">' + t.original + '</div><div class="text-xs text-slate-400">❌ Mancante</div></div><a href="https://open.spotify.com/search/' + encodeURIComponent(t.original) + '" target="_blank" class="text-xs bg-green-600 px-2 py-1 rounded text-white">🔍</a></div>';
      }).join('');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    const tabFound = document.getElementById('tabFound');
    if (tabFound) tabFound.onclick = function() {
      const fl = document.getElementById('foundList');
      const ml = document.getElementById('missingList');
      if (fl) fl.classList.remove('hidden');
      if (ml) ml.classList.add('hidden');
      tabFound.classList.add('active');
      const tm = document.getElementById('tabMissing');
      if (tm) tm.classList.remove('active');
    };

    const tabMissing = document.getElementById('tabMissing');
    if (tabMissing) tabMissing.onclick = function() {
      const fl = document.getElementById('foundList');
      const ml = document.getElementById('missingList');
      if (fl) fl.classList.add('hidden');
      if (ml) ml.classList.remove('hidden');
      tabMissing.classList.add('active');
      const tf = document.getElementById('tabFound');
      if (tf) tf.classList.remove('active');
    };

    const exportPresentBtn = document.getElementById('exportPresentM3U8Btn');
    if (exportPresentBtn) exportPresentBtn.onclick = function() {
      if (!lastMatched.found.length) { alert('Nessuna traccia presente'); return; }
      let m = '#EXTM3U\n# PLAYLIST: AURA - Tracce Presenti\n\n';
      lastMatched.found.forEach(function(t) { m += '#EXTINF:210,' + t.match.artist + ' - ' + t.match.title + '\n' + t.match.artist + ' - ' + t.match.title + '.mp3\n\n'; });
      dl(m, 'AURA_Presenti');
    };

    const exportMissingBtn = document.getElementById('exportMissingM3U8Btn');
    if (exportMissingBtn) exportMissingBtn.onclick = function() {
      if (!lastMatched.missing.length) { alert('Nessuna traccia mancante'); return; }
      let m = '#EXTM3U\n# PLAYLIST: AURA - Tracce Mancanti\n\n';
      lastMatched.missing.forEach(function(t) { m += '#EXTINF:210,' + t.original + '\n# SPOTIFY: https://open.spotify.com/search/' + encodeURIComponent(t.original) + '\n' + t.original + '.mp3\n\n'; });
      dl(m, 'AURA_Mancanti');
    };

    const exportMissingSpotifyBtn = document.getElementById('exportMissingSpotifyBtn');
    if (exportMissingSpotifyBtn) exportMissingSpotifyBtn.onclick = function() {
      if (!lastMatched.missing.length) { alert('Nessuna traccia mancante'); return; }
      const names = lastMatched.missing.map(function(t) { return encodeURIComponent(t.artist + ' ' + t.title); }).join(',');
      window.open('https://open.spotify.com/search/' + names, '_blank');
    };

    const createSpotifyBtn = document.getElementById('createSpotifyPlaylistBtn');
    if (createSpotifyBtn) createSpotifyBtn.onclick = function() {
      if (!lastMatched.missing.length) { alert('Nessuna traccia mancante'); return; }
      const names = lastMatched.missing.map(function(t) { return encodeURIComponent(t.artist + ' ' + t.title); }).join(',');
      window.open('https://open.spotify.com/search/' + names, '_blank');
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

    const loadChartsBtn = document.getElementById('loadChartsBtn');
    if (loadChartsBtn) loadChartsBtn.onclick = async function() {
      const c = document.getElementById('countrySelect').value;
      const l = document.getElementById('chartsList');
      const ca = document.getElementById('chartsActions');
      if (l) l.innerHTML = '<p class="text-center text-slate-400 py-4">Caricamento...</p>';
      if (ca) ca.classList.add('hidden');
      try {
        const r = await fetch('https://itunes.apple.com/' + c + '/rss/topsongs/limit=50/json');
        if (!r.ok) throw new Error('Errore');
        const d = await r.json();
        const e = d.feed && d.feed.entry ? d.feed.entry : [];
        if (!e.length) throw new Error('Nessuna traccia');
        currentCharts = e.map(function(x, i) {
          return { rank: i + 1, title: x.title && x.title.label ? x.title.label : 'Unknown', artist: x['im:artist'] && x['im:artist'].label ? x['im:artist'].label : 'Unknown', cover: x['im:image'] && x['im:image'][2] ? x['im:image'][2].label : '' };
        });
        if (l) l.innerHTML = currentCharts.map(function(t) {
          return '<div class="bg-slate-900/50 border border-slate-700 rounded p-2 flex items-center gap-2"><span class="text-aura-gold font-bold w-8">#' + t.rank + '</span><img src="' + t.cover + '" class="w-10 h-10 rounded"><div class="flex-1 min-w-0"><div class="text-sm font-semibold truncate">' + t.title + '</div><div class="text-xs text-slate-400">' + t.artist + '</div></div></div>';
        }).join('');
        if (ca) ca.classList.remove('hidden');
      } catch (e) { if (l) l.innerHTML = '<p class="text-center text-red-400 py-4">❌ ' + e.message + '</p>'; }
    };

    const exportChartsBtn = document.getElementById('exportChartsBtn');
    if (exportChartsBtn) exportChartsBtn.onclick = function() {
      if (!currentCharts.length) return;
      let m = '#EXTM3U\n# PLAYLIST: AURA - Global Charts\n\n';
      currentCharts.forEach(function(t) { m += '#EXTINF:210,' + t.artist + ' - ' + t.title + '\n' + t.artist + ' - ' + t.title + '.mp3\n\n'; });
      dl(m, 'AURA_Charts');
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
