export const MONTH_NAMES: string[];
export interface SyncConfig { timezone: string; playlistIds: Record<string, string>; }
export interface Playlist { id: string; name: string; owner: { id: string }; external_urls?: { spotify: string }; }
export interface SyncRow { month: number; id: string | null; name: string; liked: number; existing: number; missing: string[]; }
export interface SyncPreview { accountId: string; timezone: string; rows: SyncRow[]; skipped: number; }
export class SpotifyClient {
    constructor(getToken: () => Promise<string>, fetcher?: typeof fetch);
    request(path: string, method?: string, body?: unknown): Promise<any>;
    liked(progress?: (current: number, total: number) => void): Promise<any[]>;
    playlists(): Promise<Playlist[]>;
    profile(): Promise<{ id: string }>;
    playlist(id: string): Promise<Playlist>;
    items(id: string): Promise<any[]>;
}
export function previewSync(client: SpotifyClient, config: SyncConfig, months?: number[]): Promise<SyncPreview>;
export function applySync(client: SpotifyClient, preview: SyncPreview, saveMapping: (month: number, id: string) => Promise<void>): Promise<{ month: number; id: string; added: number }[]>;
