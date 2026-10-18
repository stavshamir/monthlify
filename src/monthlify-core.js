/* Shared by the browser and the Node runner. No credentials belong here. */
const MONTH_NAMES = ['❄️ January', '🌧️ February', '☘️ March', '☔ April', '🌸 May', '🌞 June',
    '🏖️ July', '🍦 August', '🍂 September', '🎃 October', '🍁 November', '🎄 December'];
const API_ORIGIN = 'https://api.spotify.com';

class SpotifyError extends Error {
    constructor(status) {
        super(status === 401 ? 'Spotify login expired. Please log in again.'
            : status === 403 ? 'Spotify denied access. Check app permissions and Premium status.'
                : `Spotify request failed (HTTP ${status}). Please try again later.`);
        this.status = status;
    }
}

class SpotifyClient {
    constructor(getToken, fetcher = fetch, wait = ms => new Promise(resolve => setTimeout(resolve, ms))) {
        this.getToken = getToken;
        this.fetcher = fetcher;
        this.wait = wait;
    }

    async request(path, method = 'GET', body) {
        const url = new URL(path, `${API_ORIGIN}/v1/`);
        if (url.origin !== API_ORIGIN || !url.pathname.startsWith('/v1/')) {
            throw new Error('Unexpected Spotify API URL.');
        }
        for (let attempt = 0; attempt < 4; attempt++) {
            let response;
            try {
                response = await this.fetcher(url.toString(), {
                    method,
                    headers: { Authorization: `Bearer ${await this.getToken()}`, 'Content-Type': 'application/json' },
                    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
                    signal: AbortSignal.timeout(30000)
                });
            } catch (error) {
                // A failed write may have reached Spotify. A fresh preview is safer than retrying it.
                throw new Error('Could not reach Spotify. Preview again before retrying a sync.');
            }
            if (response.status === 429 && attempt < 3) {
                const seconds = Number(response.headers.get('Retry-After') || 5);
                if (!Number.isFinite(seconds) || seconds > 60 || seconds < 0) throw new SpotifyError(429);
                await this.wait(seconds * 1000);
                continue;
            }
            if (!response.ok) throw new SpotifyError(response.status);
            return response.status === 204 ? null : response.json();
        }
    }

    async pages(path, progress) {
        const all = [];
        const visited = new Set();
        while (path) {
            if (visited.has(path)) throw new Error('Spotify repeated a results page. Please try again.');
            visited.add(path);
            const page = await this.request(path);
            if (!Array.isArray(page.items)) throw new Error('Unexpected Spotify response.');
            all.push(...page.items);
            progress?.(all.length, page.total);
            path = page.next;
        }
        return all;
    }

    liked(progress) { return this.pages('me/tracks?limit=50', progress); }
    playlists() { return this.pages('me/playlists?limit=50'); }
    profile() { return this.request('me'); }
    playlist(id) { return this.request(`playlists/${encodeURIComponent(id)}`); }
    items(id) { return this.pages(`playlists/${encodeURIComponent(id)}/items?limit=50`); }
    create(month) {
        return this.request('me/playlists', 'POST', {
            name: MONTH_NAMES[month - 1], public: false,
            description: 'Created by Monthlify: songs liked in this calendar month, across all years.'
        });
    }
    add(id, uris) { return this.request(`playlists/${encodeURIComponent(id)}/items`, 'POST', { uris }); }
}

function groupLiked(items, timezone) {
    const formatter = new Intl.DateTimeFormat('en-US', { month: 'numeric', timeZone: timezone });
    const groups = Array.from({ length: 12 }, () => []);
    const seen = new Set();
    let skipped = 0;
    // Oldest first gives newly appended songs a consistent chronological order.
    const sorted = [...items].sort((a, b) => String(a?.added_at).localeCompare(String(b?.added_at)));
    for (const entry of sorted) {
        const track = entry?.track;
        const date = new Date(entry?.added_at);
        if (typeof entry?.added_at !== 'string' || !track?.id || track.is_local ||
            !track.uri?.startsWith('spotify:track:') || !Number.isFinite(date.getTime())) {
            skipped++;
            continue;
        }
        if (seen.has(track.uri)) continue;
        seen.add(track.uri);
        groups[Number(formatter.format(date)) - 1].push(track.uri);
    }
    return { groups, skipped };
}

function validateConfig(config) {
    if (!config || typeof config.timezone !== 'string' || !config.playlistIds ||
        typeof config.playlistIds !== 'object' || Array.isArray(config.playlistIds)) throw new Error('Invalid Monthlify configuration.');
    new Intl.DateTimeFormat('en-US', { timeZone: config.timezone });
    const ids = Object.values(config.playlistIds);
    if (Object.keys(config.playlistIds).some(key => !/^(?:[1-9]|1[0-2])$/.test(key)) ||
        ids.some(id => typeof id !== 'string' || !/^[A-Za-z0-9]+$/.test(id)) || new Set(ids).size !== ids.length) {
        throw new Error('Choose a different valid Spotify playlist ID for each month.');
    }
}

async function previewSync(client, config, months = Array.from({ length: 12 }, (_, i) => i + 1)) {
    validateConfig(config);
    const profile = await client.profile();
    if (!profile?.id) throw new Error('Could not identify the Spotify account.');
    const { groups, skipped } = groupLiked(await client.liked(), config.timezone);
    const rows = [];
    for (const month of months) {
        if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('Invalid month.');
        const id = config.playlistIds[month];
        let playlist = null;
        let existing = [];
        if (id) {
            playlist = await client.playlist(id);
            if (playlist.owner?.id !== profile.id) throw new Error(`${MONTH_NAMES[month - 1]}: choose a playlist you own.`);
            existing = await client.items(id);
        }
        const existingUris = new Set(existing.map(entry => (entry.item || entry.track)?.uri).filter(Boolean));
        rows.push({ month, id: id || null, name: playlist?.name || MONTH_NAMES[month - 1],
            liked: groups[month - 1].length, existing: existing.length,
            missing: groups[month - 1].filter(uri => !existingUris.has(uri)) });
    }
    return { accountId: profile.id, timezone: config.timezone, rows, skipped };
}

async function applySync(client, preview, saveMapping) {
    if ((await client.profile()).id !== preview.accountId) throw new Error('Spotify account changed. Preview again.');
    const result = [];
    for (const row of preview.rows) {
        let id = row.id;
        if (!id && row.missing.length) {
            const playlist = await client.create(row.month);
            id = playlist.id;
            if (!id) throw new Error('Spotify did not return a playlist ID.');
            // Persist before adding tracks, so a later failure can be resumed without another playlist.
            await saveMapping(row.month, id);
        }
        if (!id) continue;
        if ((await client.playlist(id)).owner?.id !== preview.accountId) throw new Error('Playlist ownership changed. Preview again.');
        // Re-read at apply time to make stale previews and partial retries safe.
        const existing = new Set((await client.items(id)).map(entry => (entry.item || entry.track)?.uri).filter(Boolean));
        const missing = row.missing.filter(uri => !existing.has(uri));
        for (let i = 0; i < missing.length; i += 100) await client.add(id, missing.slice(i, i + 100));
        result.push({ month: row.month, id, added: missing.length });
    }
    return result;
}

module.exports = { MONTH_NAMES, SpotifyClient, SpotifyError, groupLiked, validateConfig, previewSync, applySync };
