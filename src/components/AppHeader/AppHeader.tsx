import { Box, Toolbar, Typography, Button, AppBar, Snackbar, Link, IconButton, Tooltip } from "@mui/material";
import { ACCESS_TOKEN_STORAGE_KEY } from "../../constants";
import { useContext, useEffect, useState } from "react";
import { SpotifyApiClient } from "../../spotify-api-client";
import { MonthPicker } from "../MonthPicker/MonthPicker";
import { MonthContext, MonthContextType } from "../../context/MonthContextProvider";
import LaunchIcon from '@mui/icons-material/Launch';

const months: string[] = [
    '❄️ January',
    '🌧️ February',
    '☘️ March',
    '☔ April',
    '🌸 May',
    '🌞 June',
    '🏖️ July',
    '🍦 August',
    '🍂 September',
    '🎃 October',
    '🍁 November',
    '🎄 December'
];

const REDIRECT_URI = "http://localhost:3000";
const RESPONSE_TYPE = "token";
const SCOPE = 'user-read-private user-library-read playlist-modify-public';
const AUTH_URL = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=${RESPONSE_TYPE}&scope=${SCOPE}`;

interface AppHeaderProps {
    spotifyApiClient: SpotifyApiClient | null;
    setSpotifyApiClient: (spotifyApiClient: SpotifyApiClient | null) => void;
}

export function AppHeader(props: AppHeaderProps) {
    const { month, trackIds } = useContext(MonthContext)! as MonthContextType;
    const [playlistUrl, setPlaylistUrl] = useState<string>();
    const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);

    useEffect(() => {
        if (props.spotifyApiClient) {
            return;
        }

        const response = window.location.hash;
        if (!response) {
            return;
        }

        const startIndex = '#access_token='.length;
        const endIndex = response.indexOf('&')
        const extractedToken = response.substring(startIndex, endIndex);

        window.location.hash = '';
        window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, extractedToken);
        props.setSpotifyApiClient(new SpotifyApiClient(extractedToken));
    }, [props])


    function onLogin() {
        window.open(AUTH_URL, '_self');
    }

    function onLogout() {
        props.setSpotifyApiClient(null);
        window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    }

    async function savePlaylist() {
        const playlistUrl = await props.spotifyApiClient?.savePlaylist(months[month], trackIds);
        setPlaylistUrl(playlistUrl);
        setIsSnackbarOpen(true);
    }

    return <>
        <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }} elevation={0}>
            <Toolbar>
                <Typography variant="h6" component="div" style={{ marginRight: '15px' }}>
                    {months[month]}
                </Typography>
                <MonthPicker />
                <Tooltip title='Create a new playlist in Spotify with the currently displayed tracks'>
                    <Button
                        variant='outlined'
                        onClick={savePlaylist}
                        disabled={trackIds.length === 0}
                    >
                        Save playlist
                    </Button>
                </Tooltip>
                <Box sx={{ flexGrow: 1 }} />
                {props.spotifyApiClient
                    ? <Button color="inherit" onClick={onLogout}>Logout</Button>
                    : <Button color="inherit" onClick={onLogin}>Login</Button>
                }
            </Toolbar>
        </AppBar>
        <Snackbar
            open={isSnackbarOpen}
            autoHideDuration={5000}
            onClose={() => setIsSnackbarOpen(false)}
            message={"Playlist saved: " + months[month]}
            action={<Link href={playlistUrl} target='_blank'>
                <IconButton size="small" color="inherit">
                    <LaunchIcon />
                </IconButton>
            </Link>}
        />
    </>
}