import { webcrypto } from 'crypto';

const mockFetch = jest.fn();
const sessionKey = 'monthlify-session-v2';
const loginKey = 'monthlify-login-v2';

function response(data: object, ok = true) {
    return { ok, json: async () => data };
}

beforeEach(() => {
    jest.resetModules();
    localStorage.clear(); sessionStorage.clear();
    window.history.replaceState({}, '', '/');
    Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
    global.fetch = mockFetch;
    mockFetch.mockReset();
});

test('login callback validates state before exchanging a code', async () => {
    sessionStorage.setItem(loginKey, JSON.stringify({ verifier: 'test-verifier', state: 'expected', startedAt: Date.now() }));
    window.history.replaceState({}, '', '/?code=test-code&state=wrong');
    const { completeLogin } = await import('./spotify-auth');
    await expect(completeLogin()).rejects.toThrow('invalid or expired');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(window.location.search).toBe('');
});

test('valid callback exchanges a code once and stores credentials only in session storage', async () => {
    sessionStorage.setItem(loginKey, JSON.stringify({ verifier: 'test-verifier', state: 'expected', startedAt: Date.now() }));
    localStorage.setItem('monthly-access-token', 'old-placeholder');
    window.history.replaceState({}, '', '/?code=test-code&state=expected');
    mockFetch.mockResolvedValue(response({ access_token: 'access-placeholder', refresh_token: 'refresh-placeholder', expires_in: 3600 }));
    const { completeLogin, getAccessToken } = await import('./spotify-auth');
    await expect(Promise.all([completeLogin(), completeLogin()])).resolves.toEqual([true, true]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const params = mockFetch.mock.calls[0][1].body as URLSearchParams;
    expect(params.get('code_verifier')).toBe('test-verifier');
    expect(params.get('grant_type')).toBe('authorization_code');
    expect(window.location.search).toBe('');
    expect(localStorage.getItem('monthly-access-token')).toBeNull();
    await expect(getAccessToken()).resolves.toBe('access-placeholder');
});

test('expired access token refreshes once for simultaneous requests and persists rotation', async () => {
    sessionStorage.setItem(sessionKey, JSON.stringify({ accessToken: 'old-placeholder', refreshToken: 'refresh-placeholder', expiresAt: 0 }));
    mockFetch.mockResolvedValue(response({ access_token: 'new-placeholder', refresh_token: 'rotated-placeholder', expires_in: 3600 }));
    const { getAccessToken } = await import('./spotify-auth');
    await expect(Promise.all([getAccessToken(), getAccessToken()])).resolves.toEqual(['new-placeholder', 'new-placeholder']);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(sessionStorage.getItem(sessionKey)!).refreshToken).toBe('rotated-placeholder');
});

test('refresh can retain the previous refresh token, logout removes all credentials', async () => {
    sessionStorage.setItem(sessionKey, JSON.stringify({ accessToken: 'old-placeholder', refreshToken: 'refresh-placeholder', expiresAt: 0 }));
    mockFetch.mockResolvedValue(response({ access_token: 'new-placeholder', expires_in: 3600 }));
    const { getAccessToken, logout } = await import('./spotify-auth');
    await getAccessToken();
    expect(JSON.parse(sessionStorage.getItem(sessionKey)!).refreshToken).toBe('refresh-placeholder');
    logout();
    expect(sessionStorage.getItem(sessionKey)).toBeNull();
});

test('failed refresh clears unusable credentials without exposing the response', async () => {
    sessionStorage.setItem(sessionKey, JSON.stringify({ accessToken: 'old-placeholder', refreshToken: 'refresh-placeholder', expiresAt: 0 }));
    mockFetch.mockResolvedValue(response({ error: 'private response data' }, false));
    const { getAccessToken } = await import('./spotify-auth');
    await expect(getAccessToken()).rejects.toThrow('Please log in again');
    expect(sessionStorage.getItem(sessionKey)).toBeNull();
});
