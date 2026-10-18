import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AppHeader } from './AppHeader';
import { MonthContextProvider } from '../../context/MonthContextProvider';
import { SpotifyApiClient } from '../../spotify-api-client';
import { previewSync, applySync } from '../../monthlify-core';

jest.mock('../../monthlify-core', () => ({ ...jest.requireActual('../../monthlify-core'),
    previewSync: jest.fn(), applySync: jest.fn() }));

beforeEach(() => { localStorage.clear(); jest.clearAllMocks(); });

async function openSync() {
    const client = { profile: async () => ({ id: 'owner' }), playlists: async () => [] } as unknown as SpotifyApiClient;
    render(<MonthContextProvider><AppHeader spotifyApiClient={client} setSpotifyApiClient={() => {}} /></MonthContextProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Monthly sync' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Monthly sync' }));
}

test('requires a preview before enabling apply and clears the preview after success', async () => {
    (previewSync as jest.Mock).mockResolvedValue({ accountId: 'owner', timezone: 'Asia/Jerusalem', rows: [], skipped: 0 });
    (applySync as jest.Mock).mockResolvedValue([{ month: 10, id: 'october', added: 2 }]);
    await openSync();
    expect(screen.getByRole('button', { name: 'Apply additions' })).toBeDisabled();
    expect(applySync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Apply additions' })).toBeEnabled());
    expect(applySync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Apply additions' }));
    await screen.findByText(/Added 2 songs/);
    expect(applySync).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Apply additions' })).toBeDisabled();
});

test('a preview failure leaves apply disabled and gives a recoverable error', async () => {
    (previewSync as jest.Mock).mockRejectedValue(new Error('Spotify login expired. Please log in again.'));
    await openSync();
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await screen.findByText('Spotify login expired. Please log in again.');
    expect(screen.getByRole('button', { name: 'Apply additions' })).toBeDisabled();
    expect(applySync).not.toHaveBeenCalled();
});
