import { Box, Toolbar, Typography, Button, AppBar } from "@mui/material";
import { ACCESS_TOKEN_STORAGE_KEY } from "../../constants";
import { useContext, useEffect } from "react";
import { SpotifyApiClient } from "../../spotify-api-client";
import { MonthPicker } from "../MonthPicker/MonthPicker";
import { MonthContext, MonthContextType } from "../../context/MonthContextProvider";

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

const CLIENT_ID = "1600aea2add742c99b0fa00476250d61";
const REDIRECT_URI = "http://localhost:3000";
const RESPONSE_TYPE = "token";
const SCOPE = 'user-library-read';
const AUTH_URL = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=${RESPONSE_TYPE}&scope=${SCOPE}`;

interface AppHeaderProps {
    spotifyApiClient: SpotifyApiClient | null;
    setSpotifyApiClient: (spotifyApiClient: SpotifyApiClient | null) => void;
}

export function AppHeader(props: AppHeaderProps) {
    const { month } = useContext(MonthContext)! as MonthContextType;

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

    return (
        <AppBar position="static">
            <Toolbar>
                <Typography variant="h6" component="div" style={{ display: 'flex', gap: '5px', marginRight: '15px' }}>
                    {months[month]}
                </Typography>
                <MonthPicker />
                <Box sx={{ flexGrow: 1 }} />
                {props.spotifyApiClient
                    ? <Button color="inherit" onClick={onLogout}>Logout</Button>
                    : <Button color="inherit" onClick={onLogin}>Login</Button>
                }
            </Toolbar>
        </AppBar>
    );
}