import { TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody, Typography } from "@mui/material";
import { LikedTrack } from "../../spotify-api-client";
import { useContext } from "react";
import { MonthContext, MonthContextType } from "../../context/MonthContextProvider";

interface LikedTracksTableProps {
    likedTracks: LikedTrack[]
}

function toTableRow(likedTrack: LikedTrack) {
    const { track, addedAt } = likedTrack;
    return (
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
    );
}

export function LikedTracksTable(props: LikedTracksTableProps) {
    const { month } = useContext(MonthContext)! as MonthContextType;

    return (
        <TableContainer component={Paper}>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>Title</TableCell>
                        <TableCell>Album</TableCell>
                        <TableCell>Year added</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {props.likedTracks
                        .filter(({ addedAt }) => addedAt.getMonth() === month)
                        .map(toTableRow)}
                </TableBody>
            </Table>
        </TableContainer>
    );
}