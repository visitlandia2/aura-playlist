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
    if (this.users[email]) throw new Error('Utente già esistente');
    
    this.users[email] = { 
      email: email, 
      password: btoa(password),
      createdAt: new Date().toISOString()
    };
    localStorage.setItem('aura_users', JSON.stringify(this.users));
    this.session = email;
    localStorage.setItem('aura_session', email);
    return { user: { email: email } };
  },
  
  async signIn(email, password) {
    this._loadUsers();
    if (!email || !password) throw new Error('Inserisci email e password');
    
    const user = this.users[email];
    if (!user) throw new Error('Utente non trovato');
    if (user.password !== btoa(password)) throw new Error('Password errata');
    
    this.session = email;
    localStorage.setItem('aura_session', email);
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
    return { email: session };
  },
  
  isLoggedIn() { 
    const session = this.getSession();
    if (!session) return false;
    return !!this.users[session];
  },
  
  async saveLibrary(tracks, name) {
    const user = this.getUser();
    if (!user || !user.email) throw new Error('Non autenticato');
    if (!this.users[user.email]) this.users[user.email] = { libraries: {} };
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
