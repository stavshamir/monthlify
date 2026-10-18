import { SpotifyClient } from './monthlify-core';
import { getAccessToken } from './spotify-auth';

export class SpotifyApiClient extends SpotifyClient {
    constructor() { super(getAccessToken); }
    public async getAllLikedTracks(progress?: (current: number, total: number) => void): Promise<LikedTrack[]> {
        return (await this.liked(progress))
            .filter(entry => entry?.track?.id && Number.isFinite(new Date(entry.added_at).getTime()))
            .map(({ track, added_at }) => ({
                track: { id: track.id, name: track.name,
                    album: { name: track.album?.name || '', imageUrl: track.album?.images?.[0]?.url || '' },
                    artists: (track.artists || []).map((artist: { name: string }) => artist.name) },
                addedAt: new Date(added_at)
            }));
    }
}
export interface Track {
    id: string; name: string;
    album: { name: string; imageUrl: string };
    artists: string[];
}
export interface LikedTrack { track: Track; addedAt: Date; }
