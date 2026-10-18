# Monthlify

A music diary made from your Spotify Liked Songs: one playlist per **calendar month across all years**, grouped by when you saved each song.

Sync checks all 12 months, including older liked songs. It **adds missing songs** to your chosen playlists and keeps their existing contents, including songs you later unlike or add manually. It does not merge, rename, delete, or unfollow your other playlists. Running it again skips tracks already present; it does not remove pre-existing duplicates inside a playlist.

## Spotify setup

Use your existing app in the [Spotify developer dashboard](https://developer.spotify.com/dashboard). Development-mode apps require the app owner to have Spotify Premium. Add these exact redirect URIs to its settings:

```text
http://127.0.0.1:3000/
http://127.0.0.1:8888/callback
```

The first is for the browser app; the second is for the optional runner. Both use Authorization Code with PKCE. **No client secret is needed.** The app requests permission to read liked songs, list private playlists, and modify your public/private playlists. If you use a different Spotify account, it must be allowed to use the development app.

## Use the browser app locally

Install Node.js 22 or later, then run:

```sh
npm ci
cp .env.example .env.local
```

Set `REACT_APP_SPOTIFY_CLIENT_ID` in `.env.local` to your app's public client ID. Leave the redirect URI as shown unless you also change its dashboard registration.

```sh
npm start
```

Open **http://127.0.0.1:3000/** explicitly, rather than localhost. Log in, browse your liked songs by month, and open **Monthly sync**.

1. For each month, choose the existing playlist you want to maintain. Similar names are distinguished by the last six characters of their IDs; use **Open playlist** to inspect them. Leaving a month unassigned creates a private playlist only if it has songs to add.
2. Select **Preview** to see the counts. This only reads Spotify.
3. Select **Apply additions** to sync the reviewed playlists.
4. **Export configuration** saves your choices for the runner or another browser.

Playlist choices are saved in this browser, separately per Spotify account. Export them before clearing browser data. Login credentials stay in the tab's session storage; logging out or closing the tab ends that browser session. The old implicit-flow token in local storage is removed automatically.

## Manual runner (no npm install required)

The runner uses Node's built-in modules and the same sync logic as the browser. Authorize it on your own computer:

```sh
node scripts/monthlify.cjs login --client-id YOUR_PUBLIC_CLIENT_ID
```

Open the printed authorization address in a browser **on that same computer**. Login writes `.monthlify/credentials.json` with private file permissions. Never commit, upload publicly, or paste that file or its contents into chat. Refresh tokens are updated in place whenever Spotify rotates them.

Copy your browser's exported configuration to `src/monthlify.config.json`, or choose playlist IDs manually using:

```sh
node scripts/monthlify.cjs inventory
```

The configuration has a timezone and an optional playlist ID for each month, numbered 1–12:

```json
{
  "timezone": "Asia/Jerusalem",
  "playlistIds": {
    "10": "YOUR_OCTOBER_PLAYLIST_ID"
  }
}
```

Replace the example value with the ID from the inventory; the placeholder itself is not a valid ID. The ID is the part after `/playlist/` in a Spotify link, without a `?si=...` suffix. Use a different playlist you own for each month. Playlist IDs are public identifiers, not credentials.

```sh
# Read-only by default:
node scripts/monthlify.cjs sync

# Add the missing tracks after reviewing the preview:
node scripts/monthlify.cjs sync --apply

# Optional alternate configuration file:
node scripts/monthlify.cjs sync --config /absolute/path/monthlify.config.json
```

New playlist IDs are saved to the selected configuration before tracks are added. A partial track-write failure can be resumed by previewing and applying again. No write is automatically retried after an ambiguous network failure. If creating a playlist fails before its ID can be saved, check Spotify for a newly created playlist and map it before retrying. Avoid running browser and runner syncs concurrently, or using independent runners with different copies of the same configuration. Local runner processes share a lock; if a process is killed and leaves a lock file behind, confirm it is stopped before removing `.monthlify/runner.lock`.

## Optional automatic runs

Start with a successful manual preview and sync. The runner can then be scheduled on an always-on computer or a cloud VM with persistent storage and Node 22+. Transfer the private credentials file securely if you authenticated on a different computer. Keep the credentials and configuration writable by the scheduled process: both must survive runs, because login tokens can rotate and newly created playlist IDs must be remembered.

For example, a daily cron entry on a Linux host (replace every path with your actual absolute paths) keeps all months updated throughout the year:

```cron
20 6 * * * cd /absolute/path/monthlify && /absolute/path/node scripts/monthlify.cjs sync --apply >> /absolute/path/monthlify/.monthlify/sync.log 2>&1
```

The cron time uses the host's configured timezone. Song grouping always uses the IANA timezone in the JSON configuration; the default is `Asia/Jerusalem`. This makes local/cloud grouping consistent, especially for saves near midnight on a month boundary. The old app used the browser's local timezone. Change the configuration if your preferred grouping timezone differs; keep browser and runner configurations aligned. Existing tracks are preserved if you later change timezones.

Scheduling and hosting are optional and are **not enabled by checking out this code**. Check the job's logs for failures or revoked authorization. A temporary runner with only an immutable refresh-token secret needs additional handling to persist rotated tokens; the example uses persistent storage instead.

## Validation and credential review

```sh
npm run test:sync
CI=true npm test -- --watchAll=false --runInBand
CI=true npm run build
```

Sync tests cover saved-date grouping across years, timezone boundaries, repeat runs, partial failures, paging, ownership checks, and rate limits. Browser tests cover OAuth state validation, token refresh, and preview-before-apply behavior. They use fake API responses; authorize your own Spotify account for a live preview before relying on the updated integration.

The original six reachable commits were reviewed with Gitleaks v8.30.1 and a separate credential-pattern review: no secrets or tokens were found. An older commit contains a public Spotify client ID. `.env*` files and `.monthlify/` are ignored, with only `.env.example` tracked. Browser builds embed `REACT_APP_*` values, so never put secrets in those variables.
