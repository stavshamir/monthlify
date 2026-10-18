#!/usr/bin/env node
// Node 22+, no npm dependencies. Credentials stay in a private, ignored file.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { SpotifyClient, MONTH_NAMES, validateConfig, previewSync, applySync } = require('../src/monthlify-core');

const ROOT = path.resolve(__dirname, '..');
const STATE = path.join(ROOT, '.monthlify');
const TOKEN_PATH = path.join(STATE, 'credentials.json');
const REDIRECT_URI = 'http://127.0.0.1:8888/callback';
const SCOPES = 'user-library-read playlist-read-private playlist-modify-public playlist-modify-private';

function writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    const temp = `${file}.${process.pid}.tmp`;
    try {
        fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
        fs.renameSync(temp, file);
    } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}

async function tokenRequest(params) {
    let response;
    try {
        response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params, signal: AbortSignal.timeout(30000)
        });
    } catch { throw new Error('Could not reach Spotify login. Please try again.'); }
    if (!response.ok) throw new Error(`Spotify login failed (HTTP ${response.status}). Run login again if authorization expired.`);
    return response.json();
}

function saveTokens(clientId, data, previous) {
    if (!data.access_token || !(data.refresh_token || previous)) throw new Error('Spotify returned an incomplete login.');
    const credentials = { clientId, accessToken: data.access_token,
        refreshToken: data.refresh_token || previous, expiresAt: Date.now() + data.expires_in * 1000 };
    writeJson(TOKEN_PATH, credentials);
    return credentials;
}

async function login(clientId) {
    if (!/^[a-f0-9]{32}$/i.test(clientId || '')) throw new Error('Use login --client-id YOUR_PUBLIC_SPOTIFY_CLIENT_ID.');
    const verifier = crypto.randomBytes(64).toString('base64url');
    const state = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    let server;
    let timeout;
    const codePromise = new Promise((resolve, reject) => {
        server = http.createServer((req, res) => {
            const url = new URL(req.url, REDIRECT_URI);
            if (url.pathname !== '/callback') { res.writeHead(404); res.end(); return; }
            if (url.searchParams.get('state') !== state) { res.writeHead(400); res.end('Invalid login state.'); return; }
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            if (url.searchParams.has('error') || !url.searchParams.get('code')) {
                res.end('Login cancelled. You can close this tab.'); reject(new Error('Spotify login was cancelled.')); return;
            }
            res.end('Authorization received. Return to the terminal to check the result. You can close this tab.');
            resolve(url.searchParams.get('code'));
        });
        server.on('error', () => reject(new Error('Could not open login callback on 127.0.0.1:8888. Close any other runner.')));
        timeout = setTimeout(() => reject(new Error('Login timed out. Run login again.')), 300000);
    });
    try {
        server.listen(8888, '127.0.0.1');
        const params = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: REDIRECT_URI,
            scope: SCOPES, state, code_challenge_method: 'S256', code_challenge: challenge });
        console.log('Open this address in a browser on this computer to authorize Monthlify:\n');
        console.log(`https://accounts.spotify.com/authorize?${params}`);
        const code = await codePromise;
        const data = await tokenRequest(new URLSearchParams({ client_id: clientId, grant_type: 'authorization_code',
            code, redirect_uri: REDIRECT_URI, code_verifier: verifier }));
        saveTokens(clientId, data);
        console.log('\nLogin saved to .monthlify/credentials.json. Keep this file private.');
    } finally { clearTimeout(timeout); server.close(); }
}

function tokenProvider() {
    let credentials;
    try { credentials = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8')); }
    catch { throw new Error('No usable login. Run the login command on your own computer first.'); }
    return async () => {
        if (credentials.expiresAt > Date.now() + 60000) return credentials.accessToken;
        const data = await tokenRequest(new URLSearchParams({ client_id: credentials.clientId,
            grant_type: 'refresh_token', refresh_token: credentials.refreshToken }));
        // Spotify may rotate refresh tokens. Persist every refresh before proceeding.
        credentials = saveTokens(credentials.clientId, data, credentials.refreshToken);
        return credentials.accessToken;
    };
}

function options(args) {
    const result = { command: args[0] || 'help', apply: false, config: path.join(ROOT, 'src/monthlify.config.json') };
    for (let i = 1; i < args.length; i++) {
        const flag = args[i];
        if (flag === '--apply') result.apply = true;
        else if (flag === '--dry-run') { /* preview is already the default */ }
        else if (['--client-id', '--config'].includes(flag) && args[i + 1] && !args[i + 1].startsWith('--')) {
            result[flag === '--client-id' ? 'clientId' : 'config'] = args[++i];
        } else throw new Error(`Unknown or incomplete option: ${flag}`);
    }
    return result;
}

async function main() {
    const opts = options(process.argv.slice(2));
    if (opts.command === 'help') {
        console.log('Monthlify (Node 22+)\n\n  node scripts/monthlify.cjs login --client-id ID\n  node scripts/monthlify.cjs inventory\n  node scripts/monthlify.cjs sync [--config FILE] [--dry-run | --apply]\n\nSync previews by default; only --apply writes to Spotify.');
        return;
    }
    if (!['login', 'sync', 'inventory'].includes(opts.command)) throw new Error('Unknown command. Run without arguments for help.');
    fs.mkdirSync(STATE, { recursive: true, mode: 0o700 });
    const lockFile = path.join(STATE, 'runner.lock');
    let lock;
    try { lock = fs.openSync(lockFile, 'wx', 0o600); }
    catch { throw new Error('Another runner may be active. If a previous process crashed, verify it stopped before removing .monthlify/runner.lock.'); }
    try {
        if (opts.command === 'login') { await login(opts.clientId); return; }
        const client = new SpotifyClient(tokenProvider());
        if (opts.command === 'inventory') {
            const profile = await client.profile();
            const playlists = (await client.playlists()).filter(p => p.owner?.id === profile.id);
            console.table(playlists.map(p => ({ name: p.name, id: p.id, url: `https://open.spotify.com/playlist/${p.id}` })));
            return;
        }
        const configPath = path.resolve(opts.config);
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        validateConfig(config);
        const preview = await previewSync(client, config);
        console.log(`Saved-date timezone: ${config.timezone}. Existing songs and other playlists will be kept.`);
        console.table(preview.rows.map(row => ({ month: MONTH_NAMES[row.month - 1],
            playlist: row.id ? row.name : '(create private playlist if needed)', liked: row.liked, existing: row.existing, add: row.missing.length })));
        if (preview.skipped) console.log(`Skipped ${preview.skipped} invalid or unavailable library entries.`);
        if (!opts.apply) { console.log('Preview only. Run with --apply to add these songs.'); return; }
        const result = await applySync(client, preview, async (month, id) => {
            config.playlistIds[month] = id; writeJson(configPath, config);
        });
        console.log(`Sync complete. Added ${result.reduce((sum, row) => sum + row.added, 0)} songs.`);
    } finally { fs.closeSync(lock); fs.unlinkSync(lockFile); }
}

main().catch(error => {
    // Never dump fetch/HTTP objects or OAuth response bodies; they can contain credentials.
    const safe = error instanceof SyntaxError ? 'Could not read configuration or login data. Check JSON files or log in again.'
        : error.code ? 'A local file or callback could not be accessed. Check your configuration and file permissions.'
            : error.message || 'Monthlify failed. Please try again.';
    console.error(safe); process.exitCode = 1;
});
