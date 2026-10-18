import { useEffect, useState } from 'react';

import './App.css';
import { ThemeProvider } from '@emotion/react';
import { Alert, createTheme, CssBaseline, Typography, CircularProgress, Stack, Toolbar } from '@mui/material';
import { LikedTrack, SpotifyApiClient } from './spotify-api-client';
import { AppHeader } from './components/AppHeader/AppHeader';
import { completeLogin } from './spotify-auth';
import { LikedTracksTable } from './components/LikedTracksTable/LikedTracksTable';
import { MonthContextProvider } from './context/MonthContextProvider';


const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

function App() {
  const [spotifyApiClient, setSpotifyApiClient] = useState<SpotifyApiClient | null>(null);
  const [error, setError] = useState('');
  const [likedTracks, setLikedTracks] = useState<LikedTrack[] | null>(null);
  const [likedTracksFetchProgress, setLikedTracksFetchProgress] = useState<number>(0);

  useEffect(() => {
    let active = true;
    completeLogin().then(loggedIn => {
      if (active && loggedIn) setSpotifyApiClient(new SpotifyApiClient());
    }).catch(() => { if (active) setError('Spotify login failed. Please log in again.'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setLikedTracks(null);
    setLikedTracksFetchProgress(0);
    setError('');
    if (!spotifyApiClient) {
      return;
    }

    let active = true;
    spotifyApiClient
      .getAllLikedTracks((count: number, total: number) => {
        if (active) setLikedTracksFetchProgress(total ? Math.min(100, count / total * 100) : 100);
      })
      .then(r => { if (active) setLikedTracks(r); })
      .catch(() => { if (active) setError('Could not load liked songs. Try logging out and logging in again.'); });
    return () => { active = false; };
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
          <CircularProgress
            size='5rem'
            variant='determinate'
            value={likedTracksFetchProgress} />
          <Typography variant="body1">Fetching all liked songs...</Typography>
        </Stack>
      );
    }

    return <LikedTracksTable likedTracks={likedTracks!!} />;
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />

      <MonthContextProvider>
        <AppHeader
          spotifyApiClient={spotifyApiClient}
          setSpotifyApiClient={setSpotifyApiClient}
        />
        <Toolbar />
        {error ? <Alert severity="error">{error}</Alert> : getContent()}
      </MonthContextProvider>

    </ThemeProvider >
  );
}

export default App;
