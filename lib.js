// AURA - Local Storage (no Supabase needed)
const supabase = {
  session: null,
  users: {},
  
  async signUp(email, password) {
    if (this.users[email]) throw new Error('Utente già esistente');
    if (password.length < 6) throw new Error('Password minimo 6 caratteri');
    const token = btoa(email + ':' + password + ':' + Date.now());
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
    if (btoa(password) !== user.password) throw new Error('Password errata');
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
  
  isLoggedIn() {
    return !!this.getSession();
  },
  
  async resetPassword(email) {
    this._loadUsers();
    if (!this.users[email]) throw new Error('Email non registrata');
    return { message: 'Contatta l\'amministratore per resettare la password' };
  },
  
  async saveLibrary(tracks, name) {
    this._loadUsers();
    const user = this.getUser();
    if (!user) throw new Error('Non autenticato');
    if (!this.users[user.email].libraries) this.users[user.email].libraries = {};
    this.users[user.email].libraries[name] = tracks;
    localStorage.setItem('aura_users', JSON.stringify(this.users));
    return { success: true };
  },
  
  async loadLibrary() {
    this._loadUsers();
    const user = this.getUser();
    if (!user) return null;
    const libs = this.users[user.email]?.libraries;
    if (!libs) return null;
    const names = Object.keys(libs);
    if (names.length === 0) return null;
    const lastLib = libs[names[names.length - 1]];
    return { tracks: lastLib, name: names[names.length - 1] };
  },
  
  _loadUsers() {
    const data = localStorage.getItem('aura_users');
    if (data) this.users = JSON.parse(data);
  }
};
