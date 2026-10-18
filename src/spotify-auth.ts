const CLIENT_ID = process.env.REACT_APP_SPOTIFY_CLIENT_ID || '';
const REDIRECT_URI = process.env.REACT_APP_SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:3000/';
const SESSION_KEY = 'monthlify-session-v2';
const LOGIN_KEY = 'monthlify-login-v2';
const SCOPES = 'user-library-read playlist-read-private playlist-modify-public playlist-modify-private';
type Session = { accessToken: string; refreshToken: string; expiresAt: number };
let refresh: Promise<string> | null = null;
let completing: Promise<boolean> | null = null;

function base64url(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...Array.from(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function exchange(params: URLSearchParams, previousRefresh?: string): Promise<string> {
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params
    });
    if (!response.ok) {
        sessionStorage.removeItem(SESSION_KEY);
        throw new Error('Spotify login failed or expired. Please log in again.');
    }
    const data = await response.json();
    const refreshToken = data.refresh_token || previousRefresh;
    if (!data.access_token || !refreshToken) throw new Error('Spotify returned an incomplete login. Please log in again.');
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ accessToken: data.access_token,
        refreshToken, expiresAt: Date.now() + data.expires_in * 1000 }));
    return data.access_token;
}

export async function login(): Promise<void> {
    if (!CLIENT_ID) throw new Error('Set REACT_APP_SPOTIFY_CLIENT_ID in .env.local, then restart the app.');
    if (window.location.origin !== new URL(REDIRECT_URI).origin) {
        throw new Error(`Open the app at ${new URL(REDIRECT_URI).origin} before logging in.`);
    }
    const verifier = base64url(crypto.getRandomValues(new Uint8Array(64)));
    const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    sessionStorage.setItem(LOGIN_KEY, JSON.stringify({ verifier, state, startedAt: Date.now() }));
    const params = new URLSearchParams({ client_id: CLIENT_ID, response_type: 'code', redirect_uri: REDIRECT_URI,
        scope: SCOPES, state, code_challenge_method: 'S256', code_challenge: challenge });
    window.location.assign(`https://accounts.spotify.com/authorize?${params}`);
}

export function completeLogin(): Promise<boolean> {
    if (completing) return completing;
    completing = (async () => {
        // Remove credentials left by the old implicit-flow implementation.
        localStorage.removeItem('monthly-access-token');
        if (window.location.hash.startsWith('#access_token=')) {
            window.history.replaceState({}, '', window.location.pathname + window.location.search);
        }
        const params = new URLSearchParams(window.location.search);
        if (!params.has('code') && !params.has('error')) return hasSession();
        const stored = sessionStorage.getItem(LOGIN_KEY);
        sessionStorage.removeItem(LOGIN_KEY);
        window.history.replaceState({}, '', window.location.pathname);
        if (!stored) throw new Error('Login session is missing. Please log in again.');
        const pending = JSON.parse(stored);
        if (params.get('state') !== pending.state || Date.now() - pending.startedAt > 600000) {
            throw new Error('Login session is invalid or expired. Please log in again.');
        }
        if (params.has('error')) throw new Error('Spotify login was cancelled.');
        await exchange(new URLSearchParams({ grant_type: 'authorization_code', code: params.get('code')!,
            redirect_uri: REDIRECT_URI, client_id: CLIENT_ID, code_verifier: pending.verifier }));
        return true;
    })();
    return completing;
}

export function hasSession(): boolean { return Boolean(sessionStorage.getItem(SESSION_KEY)); }
export function logout(): void {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(LOGIN_KEY);
    localStorage.removeItem('monthly-access-token');
    completing = null;
}

export async function getAccessToken(): Promise<string> {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) throw new Error('Please log in to Spotify.');
    const session: Session = JSON.parse(raw);
    if (session.expiresAt > Date.now() + 60000) return session.accessToken;
    if (!refresh) refresh = exchange(new URLSearchParams({ grant_type: 'refresh_token',
        client_id: CLIENT_ID, refresh_token: session.refreshToken }), session.refreshToken).finally(() => { refresh = null; });
    return refresh;
}
