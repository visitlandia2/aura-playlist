function parseCSVContent(content) {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  
  const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  console.log('📋 Header CSV:', header);
  
  // Trova indici colonne con match ESATTO (non includes)
  let artistIdx = -1, titleIdx = -1;
  
  header.forEach((h, i) => {
    // Match esatto per evitare "Nome dell'artista dell'album"
    if (h === "nome dell'artista" || h === 'artist' || h === 'artist name') {
      artistIdx = i;
    }
    if (h === "nome della traccia" || h === 'track name' || h === 'title') {
      titleIdx = i;
    }
  });
  
  // Fallback: se non trova, usa posizioni fisse Exportify italiano
  // Formato: URI traccia(0), Nome traccia(1), URI artista(2), Nome artista(3)
  if (artistIdx === -1 || titleIdx === -1) {
    if (header.length >= 4) {
      titleIdx = 1;
      artistIdx = 3;
    } else {
      artistIdx = 0;
      titleIdx = 1;
    }
  }
  
  console.log('📊 Indici corretti: Artist=', artistIdx, 'Title=', titleIdx);
  
  const tracks = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length <= Math.max(artistIdx, titleIdx)) continue;
    
    const artist = cols[artistIdx];
    const title = cols[titleIdx];
    
    if (artist && title && artist !== "nome dell'artista" && title !== "nome della traccia") {
      tracks.push({ 
        artist: artist, 
        title: title, 
        original: artist + ' - ' + title 
      });
    }
  }
  
  console.log('✅ Parse CSV:', tracks.length, 'tracce trovate');
  if (tracks.length > 0) console.log('Prima traccia:', tracks[0]);
  if (tracks.length > 1) console.log('Seconda traccia:', tracks[1]);
  return tracks;
}
