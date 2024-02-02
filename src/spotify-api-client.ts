import axios from "axios";

interface LikedTrackApiResponse {
    items: {
        added_at: string;
        track: {
            album: {
                name: string;
                images: {
                    url: string;
                    height?: number;
                    width?: number;
                }[];
            };
            artists: {
                name: string;
            }[];
            name: string;
            id: string;
        }
    }[];
    total: number;
}

export class SpotifyApiClient {

    private headers;

    constructor(accessToken: string) {
        this.headers = {
            Authorization: `Bearer ${accessToken}`
        };
    }

    public async getAllLikedTracks(progressCallback?: (currentCount: number, total: number) => void): Promise<LikedTrack[]> {
        const limit = 50;
        let offset = 0;
        let { total } = await this.getLikedTracks(1, 0);
        let all: LikedTrack[] = [];

        while (all.length < total) {
            let { likedTracks } = await this.getLikedTracks(limit, offset);
            all = [...all, ...likedTracks];
            offset += limit;
            progressCallback?.(all.length, total);
        }

        return all;
    }

    public async savePlaylist(playlistName: string, trackIds: string[]): Promise<string> {
        const { id, url } = await this.createPlaylist(playlistName);
        const batchSize = 100;
        for (let i = 0; i < trackIds.length; i += batchSize) {
            const batch = trackIds.slice(i, i + batchSize);
            await axios.post(
                `https://api.spotify.com/v1/playlists/${id}/tracks`,
                { uris: batch.map(id => `spotify:track:${id}`) },
                { headers: this.headers }
            );
        }

        return url;
    }

    private async createPlaylist(playlistName: string): Promise<{ id: string, url: string }> {
        const userId = await this.getCurrentUserId();
        const response = await axios.post<{ id: string, external_urls: { spotify: string } }>(
            `https://api.spotify.com/v1/users/${userId}/playlists`,
            { name: playlistName, description: 'Created by Monthly from your liked tracks' },
            { headers: this.headers }
        );
        return {
            id: response.data.id,
            url: response.data.external_urls.spotify
        };
    }

    private async getCurrentUserId(): Promise<string> {
        const response = await axios.get<{ id: string }>('https://api.spotify.com/v1/me', { headers: this.headers });
        return response.data.id;
    }

    private async getLikedTracks(limit: number, offset: number): Promise<{ likedTracks: LikedTrack[], total: number }> {
        const response = await axios.get<LikedTrackApiResponse>('https://api.spotify.com/v1/me/tracks', {
            headers: this.headers,
            params: {
                limit: limit,
                offset: offset
            }
        });

        return {
            likedTracks: response.data.items.map(this.toLikedTrack),
            total: response.data.total
        };
    }

    private toLikedTrack(trackItem: LikedTrackApiResponse['items'][0]) {
        const { track, added_at } = trackItem;
        return {
            track: {
                id: track.id,
                name: track.name,
                album: {
                    name: track.album.name,
                    imageUrl: track.album.images[0].url
                },
                artists: track.artists.map(artist => artist.name)
            },
            addedAt: new Date(added_at)
        }
    }

}

export interface Track {
    id: string;
    name: string;
    album: { name: string, imageUrl: string };
    artists: string[];
}

export interface LikedTrack {
    track: Track;
    addedAt: Date;
}