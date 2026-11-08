const supabase = {
  session: null,
  users: {},
  _loaded: false,
  
  _loadUsers() {
    try {
      const data = localStorage.getItem('aura_users');
      if (data) {
        this.users = JSON.parse(data);
      } else {
        this.users = {};
      }
    } catch(e) {
      console.error('Errore caricamento utenti:', e);
      this.users = {};
    }
    this._loaded = true;
  },
  
  _saveUsers() {
    try {
      localStorage.setItem('aura_users', JSON.stringify(this.users));
    } catch(e) {
      console.error('Errore salvataggio utenti:', e);
    }
  },
  
  async signUp(email, password) {
    this._loadUsers();
    
    if (!email || !password) {
      throw new Error('Inserisci email e password');
    }
    
    if (password.length < 6) {
      throw new Error('Password minimo 6 caratteri');
    }
    
    if (this.users[email]) {
      throw new Error('Utente già esistente. Clicca Accedi.');
    }
    
    // Crea utente
    this.users[email] = {
      email: email,
      password: btoa(password),
      createdAt: new Date().toISOString(),
      libraries: {}
    };
    
    // Salva
    this._saveUsers();
    
    // Login automatico
    this.session = email;
    localStorage.setItem('aura_session', email);
    
    console.log('✅ Utente registrato:', email);
    return { user: { email: email } };
  },
  
  async signIn(email, password) {
    this._loadUsers();
    
    if (!email || !password) {
      throw new Error('Inserisci email e password');
    }
    
    const user = this.users[email];
    
    if (!user) {
      throw new Error('Utente non trovato. Registrati prima.');
    }
    
    if (user.password !== btoa(password)) {
      throw new Error('Password errata.');
    }
    
    this.session = email;
    localStorage.setItem('aura_session', email);
    
    console.log('✅ Login riuscito:', email);
    return { user: { email: email } };
  },
  
  signOut() {
    this.session = null;
    localStorage.removeItem('aura_session');
    console.log('👋 Logout effettuato');
  },
  
  getSession() {
    return this.session || localStorage.getItem('aura_session');
  },
  
  getUser() {
    const session = this.getSession();
    if (!session) return null;
    
    this._loadUsers();
    
    if (this.users[session]) {
      return { email: session };
    }
    
    return null;
  },
  
  isLoggedIn() {
    const session = this.getSession();
    if (!session) return false;
    
    this._loadUsers();
    return !!this.users[session];
  },
  
  async saveLibrary(tracks, name) {
    const user = this.getUser();
    if (!user || !user.email) {
      throw new Error('Non autenticato');
    }
    
    this._loadUsers();
    
    if (!this.users[user.email]) {
      this.users[user.email] = { libraries: {} };
    }
    
    if (!this.users[user.email].libraries) {
      this.users[user.email].libraries = {};
    }
    
    this.users[user.email].libraries[name] = {
      tracks: tracks,
      savedAt: new Date().toISOString()
    };
    
    this._saveUsers();
    
    console.log('✅ Libreria salvata:', name, '-', tracks.length, 'tracce');
    return { success: true };
  },
  
  async loadLibrary() {
    const user = this.getUser();
    if (!user || !user.email) return null;
    
    this._loadUsers();
    
    if (!this.users[user.email]) return null;
    
    const libs = this.users[user.email].libraries;
    if (!libs) return null;
    
    const keys = Object.keys(libs);
    if (keys.length === 0) return null;
    
    const lastKey = keys[keys.length - 1];
    console.log('📚 Libreria caricata:', lastKey, '-', libs[lastKey].tracks.length, 'tracce');
    
    return { name: lastKey, tracks: libs[lastKey].tracks };
  }
};
