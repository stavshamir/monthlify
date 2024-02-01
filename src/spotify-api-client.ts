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
}

export class SpotifyApiClient {

    private headers;

    constructor(accessToken: string) {
        this.headers = {
            Authorization: `Bearer ${accessToken}`
        };
    }

    public async getAllLikedTracks(): Promise<LikedTrack[]> {
        const limit = 50;
        let offset = 0;
        let itemsCount = limit;
        let all: LikedTrack[] = [];

        while (itemsCount === limit) {
            let currentTracks = await this.getLikedTracks(limit, offset);
            all = [...all, ...currentTracks];
            offset += limit;
            itemsCount = currentTracks.length;
        }

        return all;
    }

    private async getLikedTracks(limit: number, offset: number): Promise<LikedTrack[]> {
        const response = await axios.get<LikedTrackApiResponse>('https://api.spotify.com/v1/me/tracks', {
            headers: this.headers,
            params: {
                limit: limit,
                offset: offset
            }
        });

        return response.data.items.map(this.toLikedTrack);
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