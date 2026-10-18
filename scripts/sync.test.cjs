const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SpotifyClient, groupLiked, validateConfig, previewSync, applySync } = require('../src/monthlify-core');

const liked = (id, date = '2026-10-15T12:00:00Z') => ({
    added_at: date, track: { id, uri: `spotify:track:${id}` }
});
const config = () => ({ timezone: 'Asia/Jerusalem', playlistIds: { 10: 'october' } });
class FakeSpotify {
    constructor() {
        this.library = [liked('old', '2024-10-15T12:00:00Z'), liked('new')];
        this.contents = { october: [{ item: { uri: 'spotify:track:old' } }, { item: { uri: 'spotify:track:kept' } }] };
        this.writes = [];
        this.account = 'owner';
    }
    async profile() { return { id: this.account }; }
    async liked() { return this.library; }
    async playlist(id) { return { id, name: id, owner: { id: 'owner' } }; }
    async items(id) { return this.contents[id] || []; }
    async create(month) {
        const id = `created${month}`; this.contents[id] = [];
        this.writes.push(['create', month]); return { id };
    }
    async add(id, uris) {
        this.writes.push(['add', id, uris]);
        this.contents[id].push(...uris.map(uri => ({ item: { uri } })));
    }
}

test('groups all years by saved date with timezone boundaries, skips bad entries, deduplicates', () => {
    const result = groupLiked([liked('a', '2024-10-01T12:00:00Z'), liked('b', '2026-09-30T22:30:00Z'),
        liked('a'), { track: null }, null, liked('missingdate', null), liked('bad', 'invalid'),
        { ...liked('local'), track: { ...liked('local').track, is_local: true } }], 'Asia/Jerusalem');
    assert.deepEqual(result.groups[9], ['spotify:track:a', 'spotify:track:b']);
    assert.equal(result.skipped, 5);
    assert.equal(groupLiked([liked('b', '2026-09-30T22:30:00Z')], 'UTC').groups[8].length, 1);
});

test('preview is read-only, additions preserve manual and formerly liked songs, second run is empty', async () => {
    const api = new FakeSpotify();
    const preview = await previewSync(api, config());
    assert.equal(api.writes.length, 0);
    assert.equal(preview.rows[9].liked, 2);
    assert.deepEqual(preview.rows[9].missing, ['spotify:track:new']);
    await applySync(api, preview, async () => assert.fail('must reuse mapped playlist'));
    assert.equal(api.contents.october.length, 3);
    await applySync(api, await previewSync(api, config()), async () => {});
    assert.equal(api.writes.length, 1);
});

test('apply rechecks playlist contents so replaying a preview does not duplicate tracks', async () => {
    const api = new FakeSpotify(), preview = await previewSync(api, config());
    await applySync(api, preview, async () => {});
    await applySync(api, preview, async () => {});
    assert.equal(api.writes.length, 1);
});

test('new playlist ID is saved before any track write and empty months are not created', async () => {
    const api = new FakeSpotify();
    const cfg = { timezone: 'UTC', playlistIds: {} };
    const preview = await previewSync(api, cfg);
    let saved = false;
    const original = api.add.bind(api);
    api.add = async (...args) => { assert.ok(saved); return original(...args); };
    await applySync(api, preview, async (month, id) => { saved = true; cfg.playlistIds[month] = id; });
    assert.deepEqual(cfg.playlistIds, { 10: 'created10' });
    assert.equal(api.writes.filter(w => w[0] === 'create').length, 1);
});

test('partial batch failure resumes through a fresh preview without duplicates', async () => {
    const api = new FakeSpotify();
    api.library = Array.from({ length: 205 }, (_, i) => liked(`song${i}`));
    api.contents.october = [];
    const original = api.add.bind(api);
    let calls = 0;
    api.add = async (...args) => { if (++calls === 2) throw new Error('network interruption'); return original(...args); };
    await assert.rejects(applySync(api, await previewSync(api, config()), async () => {}));
    assert.equal(api.contents.october.length, 100);
    api.add = original;
    await applySync(api, await previewSync(api, config()), async () => {});
    assert.equal(api.contents.october.length, 205);
    assert.equal(new Set(api.contents.october.map(row => row.item.uri)).size, 205);
    assert.ok(api.writes.filter(row => row[0] === 'add').every(row => row[2].length <= 100));
});

test('failed mapping persistence prevents track writes', async () => {
    const api = new FakeSpotify();
    const preview = await previewSync(api, { timezone: 'UTC', playlistIds: {} });
    await assert.rejects(applySync(api, preview, async () => { throw new Error('disk full'); }));
    assert.deepEqual(api.writes, [['create', 10]]);
});

test('validates mappings and timezone before any Spotify requests', async () => {
    assert.throws(() => validateConfig({ timezone: 'UTC', playlistIds: { 1: 'same', 2: 'same' } }));
    assert.throws(() => validateConfig({ timezone: 'UTC', playlistIds: { 13: 'bad' } }));
    assert.throws(() => validateConfig({ timezone: 'UTC', playlistIds: { 1: '../bad' } }));
    assert.throws(() => validateConfig({ timezone: 'invalid', playlistIds: {} }));
    const api = new FakeSpotify();
    api.profile = async () => assert.fail('configuration must be validated first');
    await assert.rejects(previewSync(api, { timezone: 'invalid', playlistIds: {} }));
});

test('refuses a playlist owned by someone else and an account switch after preview', async () => {
    const api = new FakeSpotify();
    const preview = await previewSync(api, config());
    api.account = 'different';
    await assert.rejects(applySync(api, preview, async () => {}), /account changed/);
    await assert.rejects(previewSync(api, config()), /you own/);
    assert.equal(api.writes.length, 0);
});

test('supports old and new playlist item response fields, including unavailable items', async () => {
    const api = new FakeSpotify();
    api.contents.october = [{ track: { uri: 'spotify:track:new' } }, { item: null }];
    const preview = await previewSync(api, config());
    assert.deepEqual(preview.rows[9].missing, ['spotify:track:old']);
});

test('paginates using next links rather than counting valid tracks', async () => {
    const paths = [];
    const api = new SpotifyClient(async () => 'test-placeholder', async url => {
        paths.push(url);
        return new Response(JSON.stringify(paths.length === 1
            ? { items: [null], total: 2, next: 'https://api.spotify.com/v1/me/tracks?offset=1' }
            : { items: [liked('a')], total: 2, next: null }));
    });
    assert.equal((await api.liked()).length, 2);
    assert.equal(paths.length, 2);
});

test('never sends a bearer token to a foreign pagination URL', async () => {
    let requests = 0;
    const api = new SpotifyClient(async () => 'test-placeholder', async () => {
        requests++;
        return new Response(JSON.stringify({ items: [], next: 'https://example.com/steal' }));
    });
    await assert.rejects(api.liked(), /Unexpected Spotify API URL/);
    assert.equal(requests, 1);
});

test('rate limiting honors bounded Retry-After and does not retry ambiguous writes', async () => {
    let requests = 0; const waits = [];
    const api = new SpotifyClient(async () => 'test-placeholder', async () => {
        requests++;
        return requests === 1 ? new Response('', { status: 429, headers: { 'Retry-After': '2' } })
            : new Response(JSON.stringify({ id: 'ok' }));
    }, async ms => waits.push(ms));
    assert.equal((await api.profile()).id, 'ok');
    assert.deepEqual(waits, [2000]);
    let writes = 0;
    const failing = new SpotifyClient(async () => 'test-placeholder', async () => { writes++; throw new Error('do not print this'); });
    await assert.rejects(failing.add('october', []), /Preview again/);
    assert.equal(writes, 1);
});
