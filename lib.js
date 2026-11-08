const supabase = {
  session: null,
  users: {},
  _loaded: false,
  
  _loadUsers() {
    if (this._loaded) return;
    const data = localStorage.getItem('aura_users');
    if (data) { 
      try { this.users = JSON.parse(data); } 
      catch(e) { this.users = {}; } 
    }
    this._loaded = true;
  },
  
  async signUp(email, password) {
    this._loadUsers();
    if (!email || !password) throw new Error('Inserisci email e password');
    if (password.length < 6) throw new Error('Password minimo 6 caratteri');
    if (this.users[email]) throw new Error('Utente già esistente. Clicca Accedi.');
    
    const token = btoa(email + ':' + Date.now());
    this.users[email] = { 
      email: email, 
      password: btoa(password), 
      token: token, 
      libraries: {} 
    };
    localStorage.setItem('aura_users', JSON.stringify(this.users));
    this.session = token;
    localStorage.setItem('aura_session', token);
    return { user: { email: email } };
  },
  
  async signIn(email, password) {
    this._loadUsers();
    if (!email || !password) throw new Error('Inserisci email e password');
    
    const user = this.users[email];
    if (!user) throw new Error('Utente non trovato. Registrati prima.');
    if (user.password !== btoa(password)) throw new Error('Password errata.');
    
    this.session = user.token;
    localStorage.setItem('aura_session', this.session);
    return { user: { email: email } };
  },
  
  signOut() {
    this.session = null;
    localStorage.removeItem('aura_session');
  },
  
  getSession() {
    return this.session || localStorage.getItem('aura_session');
  },
  
  getUser() {
    const session = this.getSession();
    if (!session) return null;
    try {
      const decoded = atob(session);
      const email = decoded.split(':')[0];
      return { email: email };
    } catch(e) { 
      return null; 
    }
  },
  
  isLoggedIn() { 
    const session = this.getSession();
    if (!session) return false;
    const user = this.getUser();
    if (!user || !user.email) return false;
    return !!this.users[user.email];
  },
  
  async saveLibrary(tracks, name) {
    const user = this.getUser();
    if (!user || !user.email) throw new Error('Non autenticato');
    if (!this.users[user.email]) throw new Error('Utente non trovato');
    if (!this.users[user.email].libraries) this.users[user.email].libraries = {};
    this.users[user.email].libraries[name] = { 
      tracks: tracks, 
      savedAt: new Date().toISOString() 
    };
    localStorage.setItem('aura_users', JSON.stringify(this.users));
    return { success: true };
  },
  
  async loadLibrary() {
    const user = this.getUser();
    if (!user || !user.email) return null;
    if (!this.users[user.email]) return null;
    const libs = this.users[user.email].libraries;
    if (!libs) return null;
    const keys = Object.keys(libs);
    if (keys.length === 0) return null;
    const lastKey = keys[keys.length - 1];
    return { name: lastKey, tracks: libs[lastKey].tracks };
  }
};
