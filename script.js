function doMatch(spTracks) {
  if (!userLibrary.length) { 
    alert('⚠️ Carica prima la libreria!'); 
    return; 
  }
  
  const found = [];
  const missing = [];
  
  // Crea un indice per ricerca veloce
  const libraryIndex = new Map();
  userLibrary.forEach((track, index) => {
    const key = norm(track.artist) + '|' + norm(track.title);
    libraryIndex.set(key, { track, index });
  });
  
  for (let sp of spTracks) {
    const spArtistNorm = norm(sp.artist);
    const spTitleNorm = norm(sp.title);
    const spKey = spArtistNorm + '|' + spTitleNorm;
    
    // 1. Cerca match ESATTO
    if (libraryIndex.has(spKey)) {
      const match = libraryIndex.get(spKey).track;
      found.push({ 
        ...sp, 
        match: match, 
        score: { t: 100, a: 100 },
        matchType: 'exact'
      });
      continue;
    }
    
    // 2. Cerca match per titolo (artista può variare)
    let bestMatch = null;
    let bestScore = 0;
    let bestType = '';
    
    for (let lib of userLibrary) {
      const libArtistNorm = norm(lib.artist);
      const libTitleNorm = norm(lib.title);
      
      // Match esatto titolo
      if (spTitleNorm === libTitleNorm) {
        const artistSim = sim(spArtistNorm, libArtistNorm);
        if (artistSim >= 70) {
          const totalScore = 50 + (artistSim / 2);
          if (totalScore > bestScore) {
            bestScore = totalScore;
            bestMatch = lib;
            bestType = 'title-exact';
          }
        }
      }
      
      // Match fuzzy titolo
      const titleSim = sim(spTitleNorm, libTitleNorm);
      const artistSim = sim(spArtistNorm, libArtistNorm);
      
      if (titleSim >= 80 && artistSim >= 60) {
        const totalScore = (titleSim * 0.6) + (artistSim * 0.4);
        if (totalScore > bestScore) {
          bestScore = totalScore;
          bestMatch = lib;
          bestType = 'fuzzy';
        }
      }
      
      // Match solo titolo molto alto
      if (titleSim >= 95 && artistSim >= 40) {
        const totalScore = (titleSim * 0.7) + (artistSim * 0.3);
        if (totalScore > bestScore) {
          bestScore = totalScore;
          bestMatch = lib;
          bestType = 'title-high';
        }
      }
    }
    
    // Soglia abbassata al 60%
    if (bestScore >= 60 && bestMatch) {
      found.push({ 
        ...sp, 
        match: bestMatch, 
        score: { t: bestScore, a: bestScore },
        matchType: bestType
      });
    } else {
      missing.push(sp);
    }
  }
  
  lastMatched = { ...lastMatched, found, missing, spotifyTracks: spTracks };
  document.getElementById('matcherResults').classList.remove('hidden');
  document.getElementById('mTotal').innerText = spTracks.length;
  document.getElementById('mFound').innerText = found.length;
  document.getElementById('mMissing').innerText = missing.length;
  renderFound(); 
  renderMissing();
  
  console.log(`✅ Match completato: ${found.length} trovate, ${missing.length} mancanti`);
  console.log('Dettagli match:', found.map(f => `${f.matchType}: ${f.original} → ${f.match.artist} - ${f.match.title}`));
}
