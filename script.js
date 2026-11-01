const SUPABASE_URL = 'https://kmensxyzihpohcdthkwb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uUKZs-wsbevEXnD5aQ--Ug_K0bmHLDO';

const supabase = {
    url: SUPABASE_URL,
    key: SUPABASE_ANON_KEY,
    async request(endpoint, options = {}) {
        const res = await fetch(`${this.url}${endpoint}`, {
            ...options,
            headers: {
                'apikey': this.key,
                'Authorization': `Bearer ${this.getSession() || this.key}`,
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Errore di rete' }));
            throw err;
        }
        return res.json();
    },
    getSession() { return localStorage.getItem('sb_session'); },
    setSession(session) {
        if (session) localStorage.setItem('sb_session', session);
        else localStorage.removeItem('sb_session');
    },
    getUser() {
        const data = localStorage.getItem('sb_user');
        return data ? JSON.parse(data) : null;
    },
    setUser(user) {
        if (user) localStorage.setItem('sb_user', JSON.stringify(user));
        else localStorage.removeItem('sb_user');
    },
    async signUp(email, password) {
        const data = await this.request('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email, password }) });
        if (data.access_token) { this.setSession(data.access_token); this.setUser(data.user); }
        return data;
    },
    async signIn(email, password) {
        const data = await this.request('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
        if (data.access_token) { this.setSession(data.access_token); this.setUser(data.user); }
        return data;
    },
    signOut() { this.setSession(null); this.setUser(null); },
    async resetPassword(email) {
        return this.request('/auth/v1/recover', { method: 'POST', body: JSON.stringify({ email }) });
    },
    isLoggedIn() { return !!this.getSession() && !!this.getUser(); },
    async saveLibrary(tracks, libraryName = 'Libreria Engine DJ') {
        const user = this.getUser();
        if (!user) throw new Error('Devi essere loggato');
        const existing = await this.request(`/rest/v1/user_libraries?user_id=eq.${user.id}&select=id`, { method: 'GET' });
        if (existing.length > 0) {
            await this.request(`/rest/v1/user_libraries?id=eq.${existing[0].id}`, {
                method: 'PATCH',
                body: JSON.stringify({ tracks: tracks, library_name: libraryName, updated_at: new Date().toISOString() })
            });
        } else {
            await this.request('/rest/v1/user_libraries', {
                method: 'POST',
                body: JSON.stringify({ user_id: user.id, tracks: tracks, library_name: libraryName })
            });
        }
    },
    async loadLibrary() {
        const user = this.getUser();
        if (!user) return null;
        const data = await this.request(`/rest/v1/user_libraries?user_id=eq.${user.id}&select=*`, { method: 'GET' });
        return data.length > 0 ? data[0] : null;
    }
};
