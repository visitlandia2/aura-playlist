function normalizeText(text) {
  if (!text) return '';
  let t = text.toString().toLowerCase().trim();
  
  // Rimuovi contenuto tra parentesi (tonde, quadre, graffe)
  t = t.replace(/\([^)]*\)/g, ' ');
  t = t.replace(/\[[^\]]*\]/g, ' ');
  t = t.replace(/{[^}]*}/g, ' ');
  
  // Rimuovi punteggiatura speciale
  t = t.replace(/[''""`´!@#$%^&*]/g, '');
  t = t.replace(/[^\w\s]/g, ' ');
  
  // Gestisci trattini
  t = t.replace(/\s*[-–—]\s*/g, ' ');
  
  // & diventa "and"
  t = t.replace(/\s*&\s*/g, ' and ');
  
  // Rimuovi feat/ft/featuring/vs/x
  t = t.replace(/\s*(feat\.?|featuring|ft\.?)\s+/gi, ' ');
  t = t.replace(/\s*vs\.?\s+/gi, ' ');
  t = t.replace(/\s*x\s+/gi, ' ');
  
  // RIMUOVI SUFFISSI DI VERSIONE OVUNQUE (non solo alla fine!)
  const suffixes = [
    'radio edit', 'radio version', 'radio mix', 'radio cut',
    'album version', 'album mix',
    'original mix', 'original radio edit', 'original radio version',
    'extended mix', 'extended version', 'extended radio edit',
    'club mix', 'club version', 'club edit',
    'remix', 'remix version', 'remix edit',
    'remastered', 'remaster', 'remastered version',
    'fm cut', 'f m cut',
    'video mix', 'video edit',
    'live version', 'live edit',
    'acoustic version', 'acoustic mix',
    'instrumental version', 'instrumental mix',
    'single version', 'single edit',
    'new version', 'new mix',
    'short version', 'short edit',
    'long version', 'long mix',
    'dance mix', 'dance version',
    'power cut', 'power mix',
    'soulstatic radio mix',
    'italian spot version',
    'birretta edit',
    'gabry ponte ice pop radio',
    'gabry ponte fm cut',
    'gabry ponte power cut',
    'gabry ponte original radio edit',
    'molella edit', 'molella edit remix', 'molella remix',
    'roberto molinaro radio mix',
    'manian video mix',
    'mk dub revisited edit',
    'paps n skar radio remix',
    'billions dollars dogs vs vincenzo callea fast d j radio',
    'roy malone s king radio edit',
    'dj antoine vs mad mark 2k12 radio edit',
    'uk radio edit',
    'alternative 7 inch',
    'seven inch mix', '7 inch mix',
    '2005 remaster', '2015 remaster', '2015 radio',
    'radio smat mix'
  ];
  
  for (const suffix of suffixes) {
    const regex = new RegExp('\\s*' + suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'gi');
    t = t.replace(regex, ' ');
  }
  
  // Rimuovi anni alla fine
  t = t.replace(/\s*(19|20)\d{2}\s*$/g, ' ');
  
  // Rimuovi "hq", "hd", "video", "audio" alla fine
  t = t.replace(/\s*(hq|hd|video|audio)\s*$/gi, ' ');
  
  // Normalizza spazi multipli
  t = t.replace(/\s+/g, ' ').trim();
  
  return t;
}
