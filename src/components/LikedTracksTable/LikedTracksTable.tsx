import { TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody, Typography, TableSortLabel } from "@mui/material";
import { LikedTrack } from "../../spotify-api-client";
import { useContext, useMemo, useState } from "react";
import config from '../../monthlify.config.json';
import { MonthContext, MonthContextType } from "../../context/MonthContextProvider";

interface LikedTracksTableProps {
    likedTracks: LikedTrack[]
}

interface RowData {
    id: string;
    title: string;
    artists: string;
    album: {
        name: string;
        imageUrl: string;
    };
    yearAdded: number;
    monthAdded: number;
}

function toRowData(likedTrack: LikedTrack): RowData {
    const { track, addedAt } = likedTrack;
    return {
        id: track.id,
        title: track.name,
        artists: track.artists.join(', '),
        album: track.album,
        yearAdded: Number(new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: config.timezone }).format(addedAt)),
        monthAdded: Number(new Intl.DateTimeFormat('en-US', { month: 'numeric', timeZone: config.timezone }).format(addedAt)) - 1
    }
}

function toTableRow(data: RowData) {
    return (
        <TableRow key={data.id} hover>
            <TableCell>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <img src={data.album.imageUrl} alt={data.title} style={{ width: 50, height: 50, marginRight: 10 }} />
                    <div>
                        <Typography variant="body2">{data.title}</Typography>
                        <Typography variant='body2' color='grey'>{data.artists}</Typography>
                    </div>
                </div>
            </TableCell>
            <TableCell>{data.album.name}</TableCell>
            <TableCell>{data.yearAdded}</TableCell>
        </TableRow>
    );
}

export function LikedTracksTable(props: LikedTracksTableProps) {
    const { month } = useContext(MonthContext)! as MonthContextType;
    const [order, setOrder] = useState<'asc' | 'desc'>('desc');

    const handleSort = () => {
        setOrder(order === 'asc' ? 'desc' : 'asc');
    };

    const sortedRows = useMemo(() => props.likedTracks
        .map(toRowData)
        .filter(({ monthAdded }) => monthAdded === month)
        .sort((a, b) => {
            const aValue = a.yearAdded;
            const bValue = b.yearAdded;
            return (order === 'asc' ? 1 : -1) * (aValue - bValue);
        }), [props.likedTracks, month, order]);

    return (
        <TableContainer component={Paper}>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell width='40%'>Title</TableCell>
                        <TableCell width='40%'>Album</TableCell>
                        <TableCell>
                            <TableSortLabel
                                active
                                direction={order}
                                onClick={() => handleSort()}
                            >
                                Year added
                            </TableSortLabel>
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {sortedRows.map(toTableRow)}
                </TableBody>
            </Table>
        </TableContainer>
    );
}
