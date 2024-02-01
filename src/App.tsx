import { useEffect, useState } from 'react';

import './App.css';
import { ThemeProvider } from '@emotion/react';
import { createTheme, CssBaseline, Typography, CircularProgress, Stack } from '@mui/material';
import { LikedTrack, SpotifyApiClient } from './spotify-api-client';
import { AppHeader } from './components/AppHeader/AppHeader';
import { ACCESS_TOKEN_STORAGE_KEY } from './constants';
import { LikedTracksTable } from './components/LikedTracksTable/LikedTracksTable';


const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

function App() {
  const [spotifyApiClient, setSpotifyApiClient] = useState<SpotifyApiClient | null>(getApiClient());
  const [likedTracks, setLikedTracks] = useState<LikedTrack[] | null>(null);

  function getApiClient(): SpotifyApiClient | null {
    const storedToken = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    return storedToken
      ? new SpotifyApiClient(storedToken)
      : null;
  }

  useEffect(() => {
    if (!spotifyApiClient) {
      return;
    }

    spotifyApiClient
      .getAllLikedTracks()
      .then(r => setLikedTracks(r));
  }, [spotifyApiClient]);

  function getContent() {
    if (spotifyApiClient === null) {
      return (
        <Stack display='flex' justifyContent='center' alignItems='center' gap='12px' height='calc(100vh - 256px)'>
          <Typography>
            Please login
          </Typography>
        </Stack>
      );
    }

    if (spotifyApiClient && likedTracks === null) {
      return (
        <Stack display='flex' justifyContent='center' alignItems='center' gap='12px' height='calc(100vh - 256px)'>
          <CircularProgress size='5rem' />
          <Typography variant="body1">Fetching all liked songs...</Typography>
        </Stack>
      );
    }

    return <LikedTracksTable likedTracks={likedTracks!!} />;
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />

      <AppHeader
        spotifyApiClient={spotifyApiClient}
        setSpotifyApiClient={setSpotifyApiClient}
      />

      {getContent()}

    </ThemeProvider >
  );
}

export default App;
