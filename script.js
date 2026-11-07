const supabase = {
  session: null,
  users: {},
  _loaded: false,
  _loadUsers() {
    if (this._loaded) return;
    const data = localStorage.getItem('aura_users');
    if (data) { try { this.users = JSON.parse(data); } catch(e) { this.users = {}; } }
    this._loaded = true;
  },
  async signUp(email, password) {
    this._loadUsers();
    if (this.users[email]) throw new Error('Utente già esistente. Clicca Accedi.');
    if (password.length < 6) throw new Error('Password minimo 6 caratteri');
    const token = btoa(email + ':' + btoa(password) + ':' + Date.now());
    this.users[email] = { email, password: btoa(password), token, libraries: {} };
    localStorage.setItem('aura_users', JSON.stringify(this.users));
    this.session = token;
    localStorage.setItem('aura_session', token);
    return { user: { email } };
  },
  async signIn(email, password) {
    this._loadUsers();
    const user = this.users[email];
    if (!user) throw new Error('Utente non trovato. Registrati prima.');
    if (user.password !== btoa(password)) throw new Error('Password errata.');
    this.session = user.token;
    localStorage.setItem('aura_session', this.session);
    return { user: { email } };
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
      const parts = atob(session).split(':');
      return { email: parts[0], id: parts[0] };
    } catch { return null; }
  },
  isLoggedIn() { return !!this.getSession(); },
  async saveLibrary(tracks, name) {
    const session = this.getSession();
    if (!session) throw new Error('Non autenticato');
    const user = this.getUser();
    if (!user || !this.users[user.email]) throw new Error('Utente non trovato');
    if (!this.users[user.email].libraries) this.users[user.email].libraries = {};
    this.users[user.email].libraries[name] = { tracks, savedAt: new Date().toISOString() };
    localStorage.setItem('aura_users', JSON.stringify(this.users));
    return { success: true };
  },
  async loadLibrary() {
    const session = this.getSession();
    if (!session) return null;
    const user = this.getUser();
    if (!user || !this.users[user.email]) return null;
    const libs = this.users[user.email].libraries;
    if (!libs) return null;
    const firstKey = Object.keys(libs)[0];
    if (!firstKey) return null;
    return { name: firstKey, tracks: libs[firstKey].tracks };
  }
};
