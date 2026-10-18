import { Alert, Box, Toolbar, Typography, Button, AppBar, Dialog, DialogTitle, DialogContent,
    DialogActions, Table, TableHead, TableRow, TableCell, TableBody, Select, MenuItem, Link } from '@mui/material';
import { useContext, useEffect, useState } from 'react';
import { SpotifyApiClient } from '../../spotify-api-client';
import { login, logout } from '../../spotify-auth';
import { MonthPicker } from '../MonthPicker/MonthPicker';
import { MonthContext } from '../../context/MonthContextProvider';
import { MONTH_NAMES, SyncConfig, Playlist, SyncPreview, previewSync, applySync } from '../../monthlify-core';
import defaultConfig from '../../monthlify.config.json';

interface Props {
    spotifyApiClient: SpotifyApiClient | null;
    setSpotifyApiClient: (client: SpotifyApiClient | null) => void;
}

export function AppHeader({ spotifyApiClient: client, setSpotifyApiClient }: Props) {
    const { month } = useContext(MonthContext)!;
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [accountId, setAccountId] = useState('');
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [config, setConfig] = useState<SyncConfig>(defaultConfig);
    const [preview, setPreview] = useState<SyncPreview | null>(null);

    useEffect(() => {
        let active = true;
        setAccountId(''); setPreview(null);
        if (!client) return;
        Promise.all([client.profile(), client.playlists()]).then(([profile, all]) => {
            if (!active) return;
            const saved = localStorage.getItem(`monthlify-config:${profile.id}`);
            setConfig(saved ? JSON.parse(saved) : defaultConfig);
            setPlaylists(all.filter(p => p.owner?.id === profile.id));
            setAccountId(profile.id);
        }).catch(() => { if (active) setError('Could not load your playlists. Please log in again.'); });
        return () => { active = false; };
    }, [client]);

    function persist(next: SyncConfig) {
        if (!accountId) throw new Error('Please log in again.');
        localStorage.setItem(`monthlify-config:${accountId}`, JSON.stringify(next));
        setConfig(next);
    }

    async function run(action: () => Promise<void>) {
        setBusy(true); setError(''); setMessage('');
        try { await action(); }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'Something went wrong. Preview again to retry.'); }
        finally { setBusy(false); }
    }

    async function sync() {
        if (!client || !preview) return;
        const reviewed = preview; setPreview(null);
        let current = config;
        const result = await applySync(client, reviewed, async (month, id) => {
            current = { ...current, playlistIds: { ...current.playlistIds, [month]: id } };
            persist(current);
        });
        setPlaylists((await client.playlists()).filter(p => p.owner?.id === accountId));
        setMessage(`Sync complete. Added ${result.reduce((sum, row) => sum + row.added, 0)} songs. Existing songs were kept.`);
    }

    function exportConfig() {
        const url = URL.createObjectURL(new Blob([JSON.stringify(config, null, 2) + '\n'], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.download = 'monthlify.config.json'; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    return <>
        <AppBar position="fixed" elevation={0}><Toolbar>
            <Typography variant="h6">{MONTH_NAMES[month]}</Typography><MonthPicker />
            <Button variant="outlined" disabled={!client || !accountId || busy} onClick={() => setOpen(true)}>Monthly sync</Button>
            <Box sx={{ flexGrow: 1 }} />
            {client ? <Button color="inherit" disabled={busy} onClick={() => { logout(); setOpen(false); setError(''); setMessage(''); setSpotifyApiClient(null); }}>Logout</Button>
                : <Button color="inherit" disabled={busy} onClick={() => run(login)}>Login</Button>}
        </Toolbar></AppBar>
        {error && !open && <Alert severity="error" sx={{ position: 'fixed', top: 64, zIndex: 1200 }}>{error}</Alert>}
        <Dialog open={open} fullWidth maxWidth="md" onClose={() => { if (!busy) setOpen(false); }}>
            <DialogTitle>Keep your monthly playlists up to date</DialogTitle>
            <DialogContent>
                <Typography paragraph>Choose one playlist you own for each month. Preview checks all liked songs across all years.
                    Sync adds missing songs and keeps existing songs. Other playlists are left as they are.</Typography>
                <Typography paragraph>Saved dates use {config.timezone}. New playlists are private.</Typography>
                {error && <Alert severity="error">{error}</Alert>}
                {message && <Alert severity="success">{message}</Alert>}
                <Table size="small">
                    <TableHead><TableRow><TableCell>Month</TableCell><TableCell>Playlist to maintain</TableCell><TableCell>Liked songs</TableCell><TableCell>To add</TableCell></TableRow></TableHead>
                    <TableBody>{MONTH_NAMES.map((name, i) => {
                        const key = String(i + 1), id = config.playlistIds[key] || '';
                        const row = preview?.rows.find(r => r.month === i + 1);
                        return <TableRow key={key}>
                            <TableCell>{name}</TableCell>
                            <TableCell><Select size="small" fullWidth value={id} disabled={busy} displayEmpty
                                onChange={event => {
                                    const ids = { ...config.playlistIds };
                                    if (event.target.value) ids[key] = event.target.value; else delete ids[key];
                                    persist({ ...config, playlistIds: ids }); setPreview(null); setMessage('');
                                }}>
                                <MenuItem value="">Create a new playlist if needed</MenuItem>
                                {id && !playlists.some(p => p.id === id) && <MenuItem value={id}>Saved playlist · {id.slice(-6)}</MenuItem>}
                                {playlists.map(p => <MenuItem key={p.id} value={p.id}
                                    disabled={Object.entries(config.playlistIds).some(([m, chosen]) => m !== key && chosen === p.id)}>
                                    {p.name} · {p.id.slice(-6)}
                                </MenuItem>)}
                            </Select>
                                {id && <Link href={`https://open.spotify.com/playlist/${encodeURIComponent(id)}`} target="_blank" rel="noreferrer">Open playlist</Link>}
                            </TableCell>
                            <TableCell>{row?.liked ?? '—'}</TableCell><TableCell>{row?.missing.length ?? '—'}</TableCell>
                        </TableRow>;
                    })}</TableBody>
                </Table>
                {preview && preview.skipped > 0 && <Alert severity="info">Skipped {preview.skipped} unavailable or invalid library entries.</Alert>}
            </DialogContent>
            <DialogActions>
                <Button disabled={busy} onClick={exportConfig}>Export configuration</Button>
                <Button disabled={busy} onClick={() => setOpen(false)}>Close</Button>
                <Button disabled={busy || !client} onClick={() => run(async () => { setPreview(null); setPreview(await previewSync(client!, config)); })}>Preview</Button>
                <Button variant="contained" disabled={busy || !preview} onClick={() => run(sync)}>{busy ? 'Working…' : 'Apply additions'}</Button>
            </DialogActions>
        </Dialog>
    </>;
}
