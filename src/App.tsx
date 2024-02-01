import { useEffect, useState } from 'react';

import './App.css';
import { ThemeProvider } from '@emotion/react';
import { createTheme, CssBaseline, Box, AppBar, Toolbar, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress, Stack } from '@mui/material';
import { LikedTrack, SpotifyApiClient } from './spotify-api-client';


const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

const CLIENT_ID = "1600aea2add742c99b0fa00476250d61";
const REDIRECT_URI = "http://localhost:3000";
const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
const RESPONSE_TYPE = "token";
const SCOPE = 'user-library-read';
const URL = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=${RESPONSE_TYPE}&scope=${SCOPE}`;
const ACCESS_TOKEN_STORAGE_KEY = 'monthly-access-token';

const monthEmojis: { [k: string]: string } = {
  "January": "❄️",
  "February": "🌧️",
  "March": "☘️",
  "April": "☔",
  "May": "🌸",
  "June": "🌞",
  "July": "🏖️",
  "August": "🍦",
  "September": "🍂",
  "October": "🎃",
  "November": "🍁",
  "December": "🎄"
};


function App() {
  const [spotifyApiClient, setSpotifyApiClient] = useState<SpotifyApiClient | null>(getApiClient());
  const [likedTracks, setLikedTracks] = useState<LikedTrack[] | null>(null);
  const currentDate = new Date();
  const monthName = 'April';//currentDate.toLocaleDateString('en-US', { month: 'long' });

  function getApiClient(): SpotifyApiClient | null {
    const storedToken = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    return storedToken
      ? new SpotifyApiClient(storedToken)
      : null;
  }

  useEffect(() => {
    if (spotifyApiClient) {
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
    setSpotifyApiClient(new SpotifyApiClient(extractedToken));
  }, [spotifyApiClient])

  useEffect(() => {
    if (!spotifyApiClient) {
      return;
    }

    spotifyApiClient
      .getAllLikedTracks()
      .then(r => setLikedTracks(r));
  }, [spotifyApiClient]);

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />

      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              <span>{monthEmojis[monthName]}</span>
              <span>{monthName}</span>
            </Typography>
            {spotifyApiClient
              ? <Button color="inherit" onClick={() => { setSpotifyApiClient(null); setLikedTracks(null); window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY); }}>Logout</Button>
              : <Button color="inherit" onClick={() => window.open(URL, '_blank')}>Login</Button>
            }
          </Toolbar>
        </AppBar>
      </Box>

      {(spotifyApiClient && likedTracks === null)
        ? <Stack display='flex' justifyContent='center' alignItems='center' gap='12px' height='calc(100vh - 256px)'>
          <CircularProgress size='5rem' />
          <Typography variant="body1">Fetching all liked songs...</Typography>
        </Stack>
        : < TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Album</TableCell>
                <TableCell>Year added</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {likedTracks?.filter(({ addedAt }) => addedAt.getMonth() === 3).map(({ track, addedAt }) => (
                <TableRow key={track.id} hover>
                  <TableCell>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <img src={track.album.imageUrl} alt={track.name} style={{ width: 50, height: 50, marginRight: 10 }} />
                      <div>
                        <Typography variant="body2">{track.name}</Typography>
                        <Typography variant='body2' color='grey'>{track.artists.join(', ')}</Typography>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{track.album.name}</TableCell>
                  <TableCell>{addedAt.getFullYear()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      }

    </ThemeProvider >
  );
}

export default App;
