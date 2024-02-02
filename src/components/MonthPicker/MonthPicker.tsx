import { Menu, Grid, MenuItem, IconButton, styled } from "@mui/material";
import React, { useContext, useState } from "react";
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { MonthContext, MonthContextType } from "../../context/MonthContextProvider";

const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
]

const StyledMenuItem = styled(MenuItem)(() => ({
    textAlign: 'center',
    '&:hover': {
        borderRadius: '3px'
    },
}));

export function MonthPicker() {
    const { month, setMonth } = useContext(MonthContext)! as MonthContextType;
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    function handleSelectMonth(month: number): void {
        handleClose();
        setMonth(month);
    }

    return <>
        <IconButton
            onClick={handleClick}
            sx={{ mr: 2 }}
        >
            <CalendarMonthIcon />
        </IconButton>
        <Menu
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
            style={{ width: '325px' }}
            MenuListProps={{ sx: { py: 0 } }}
        >
            <Grid container >
                {months.map((m, index) =>
                    <Grid item xs={4}>
                        <StyledMenuItem
                            selected={index === month}
                            onClick={() => handleSelectMonth(index)}
                        >
                            {m}
                        </StyledMenuItem>
                    </Grid>
                )}
            </Grid>
        </Menu>
    </>
}