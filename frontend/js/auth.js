/**
 * Authentication module using Supabase Auth
 * Used on both login.html and dashboard.html
 */

const SUPABASE_AUTH_URL = 'https://lxwzszymkcdyyfnkuawi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CFqOy3tP0Yb8DyUvoMpZOQ_iY8pKw6p';

// Initialize Supabase client (loaded via CDN: window.supabase)
const supabaseClient = window.supabase.createClient(SUPABASE_AUTH_URL, SUPABASE_ANON_KEY);

class AuthManager {
    constructor() {
        this.user = null;
        this.session = null;
        this._onChangeCallbacks = [];

        // Listen for auth state changes (login, logout, token refresh)
        supabaseClient.auth.onAuthStateChange((event, session) => {
            this.session = session;
            this.user = session?.user ?? null;
            this._onChangeCallbacks.forEach(cb => cb(event, session));
        });
    }

    /** Restore session from localStorage */
    async getSession() {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        this.session = session;
        this.user = session?.user ?? null;
        return session;
    }

    /** Get JWT access token for API calls */
    getAccessToken() {
        return this.session?.access_token ?? null;
    }

    /** Email + password login */
    async signInWithEmail(email, password) {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        return data;
    }

    /** Email + password registration (sends verification email) */
    async signUpWithEmail(email, password) {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${window.location.origin}/login#verified`,
            },
        });
        if (error) throw error;
        return data;
    }

    /** Google OAuth */
    async signInWithGoogle() {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/dashboard`,
            },
        });
        if (error) throw error;
        return data;
    }

    /** Apple OAuth */
    async signInWithApple() {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'apple',
            options: {
                redirectTo: `${window.location.origin}/dashboard`,
            },
        });
        if (error) throw error;
        return data;
    }

    /** Send password reset email */
    async resetPassword(email) {
        const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/login#reset-password`,
        });
        if (error) throw error;
        return data;
    }

    /** Sign out and redirect to login */
    async signOut() {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        this.user = null;
        this.session = null;
        window.location.href = '/login';
    }

    /** Clear session locally without redirect (used by 401 handler to break redirect loops) */
    async forceSignOut() {
        try {
            await supabaseClient.auth.signOut({ scope: 'local' });
        } catch (e) {
            // Ignore errors - just clearing local state
        }
        this.user = null;
        this.session = null;
    }

    /** Register callback for auth state changes */
    onAuthChange(callback) {
        this._onChangeCallbacks.push(callback);
    }

    /** Check if user has an active session */
    isAuthenticated() {
        return !!this.session;
    }
}

// Create global singleton
const auth = new AuthManager();
window.auth = auth;


// ===================================================================
// Login Page Handlers (only run when on login.html)
// ===================================================================

if (document.getElementById('login-form')) {
    initLoginPage();
}

function initLoginPage() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const resetForm = document.getElementById('reset-form');
    const tabs = document.querySelectorAll('.auth-tab');
    const messageEl = document.getElementById('auth-message');

    // --- Tab switching ---
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            loginForm.style.display = target === 'login' ? 'flex' : 'none';
            registerForm.style.display = target === 'register' ? 'flex' : 'none';
            if (resetForm) resetForm.classList.remove('active');
            hideMessage();
        });
    });

    // --- Login ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const btn = loginForm.querySelector('.auth-submit');

        setLoading(btn, true);
        try {
            await auth.signInWithEmail(email, password);
            window.location.href = '/dashboard';
        } catch (err) {
            showMessage(mapError(err.message), 'error');
        } finally {
            setLoading(btn, false);
        }
    });

    // --- Register ---
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        const confirm = document.getElementById('register-confirm').value;
        const btn = registerForm.querySelector('.auth-submit');

        if (password !== confirm) {
            showMessage('Wachtwoorden komen niet overeen.', 'error');
            return;
        }
        if (password.length < 8) {
            showMessage('Wachtwoord moet minimaal 8 karakters bevatten.', 'error');
            return;
        }

        setLoading(btn, true);
        try {
            const result = await auth.signUpWithEmail(email, password);
            if (result.user && !result.session) {
                // Email confirmation required
                showMessage('Account aangemaakt! Controleer je e-mail voor de verificatielink.', 'success');
                registerForm.reset();
            } else {
                window.location.href = '/dashboard';
            }
        } catch (err) {
            showMessage(mapError(err.message), 'error');
        } finally {
            setLoading(btn, false);
        }
    });

    // --- Forgot password ---
    const forgotLink = document.getElementById('forgot-password-link');
    if (forgotLink) {
        forgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.style.display = 'none';
            registerForm.style.display = 'none';
            if (resetForm) resetForm.classList.add('active');
            hideMessage();
        });
    }

    // --- Back to login from reset ---
    const backLink = document.getElementById('back-to-login');
    if (backLink) {
        backLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (resetForm) resetForm.classList.remove('active');
            loginForm.style.display = 'flex';
            tabs.forEach(t => t.classList.remove('active'));
            tabs[0].classList.add('active');
            hideMessage();
        });
    }

    // --- Reset password submit ---
    const resetSubmit = document.getElementById('reset-submit');
    if (resetSubmit) {
        resetSubmit.addEventListener('click', async () => {
            const email = document.getElementById('reset-email').value.trim();
            if (!email) {
                showMessage('Vul je e-mailadres in.', 'error');
                return;
            }
            setLoading(resetSubmit, true);
            try {
                await auth.resetPassword(email);
                showMessage('Wachtwoord reset link verstuurd! Controleer je e-mail.', 'success');
            } catch (err) {
                showMessage(mapError(err.message), 'error');
            } finally {
                setLoading(resetSubmit, false);
            }
        });
    }

    // --- Social login ---
    document.getElementById('google-login')?.addEventListener('click', () => {
        auth.signInWithGoogle();
    });

    // Apple is disabled for now
    const appleBtn = document.getElementById('apple-login');
    if (appleBtn) {
        appleBtn.disabled = true;
    }

    // --- Check if already logged in ---
    // Use getUser() instead of getSession() to verify the token is actually valid.
    // getSession() can return a cached expired session, causing redirect loops.
    supabaseClient.auth.getUser().then(({ data: { user } }) => {
        if (user) {
            window.location.href = '/dashboard';
        }
    }).catch(() => {
        // Not authenticated or token invalid - stay on login page
    });

    // --- Handle hash fragments (email verification, password reset) ---
    handleAuthHash();

    // --- Helpers ---
    function showMessage(text, type) {
        messageEl.textContent = text;
        messageEl.className = `auth-message ${type}`;
        messageEl.style.display = 'block';
    }

    function hideMessage() {
        messageEl.style.display = 'none';
    }

    function setLoading(btn, loading) {
        if (loading) {
            btn.disabled = true;
            btn.dataset.originalText = btn.innerHTML;
            btn.innerHTML = '<div class="spinner"></div> Even geduld...';
        } else {
            btn.disabled = false;
            btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
        }
    }

    function mapError(msg) {
        if (msg.includes('Invalid login credentials')) return 'Ongeldig e-mailadres of wachtwoord.';
        if (msg.includes('Email not confirmed')) return 'E-mail is nog niet geverifieerd. Controleer je inbox.';
        if (msg.includes('User already registered')) return 'Dit e-mailadres is al geregistreerd.';
        if (msg.includes('Password should be')) return 'Wachtwoord moet minimaal 6 karakters bevatten.';
        return msg;
    }

    function handleAuthHash() {
        const hash = window.location.hash;
        if (hash.includes('verified')) {
            showMessage('E-mail geverifieerd! Je kunt nu inloggen.', 'success');
            window.location.hash = '';
        } else if (hash.includes('reset-password')) {
            showMessage('Je kunt nu een nieuw wachtwoord instellen.', 'info');
            window.location.hash = '';
        }
    }
}
