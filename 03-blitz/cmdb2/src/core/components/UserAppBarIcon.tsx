import * as React from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircle from '@mui/icons-material/AccountCircle';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';

import { useMutation } from "@blitzjs/rpc"
import logout from "src/auth/mutations/logout"
import { Avatar, Badge, CssBaseline } from '@mui/material';
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import { deepOrange, deepPurple, red } from '@mui/material/colors';
import NotificationsIcon from '@mui/icons-material/Notifications';

export default function UserAppBarIcon() {

    const [logoutMutation] = useMutation(logout);
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const currentUser = useCurrentUser();

    const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = async () => {
        await logoutMutation();
        handleClose();
    };

    return (
        <Box>
            <IconButton
                size="large"
                aria-label="account of current user"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={handleMenu}
                color="inherit"
                sx={{ padding: 0 }}
            >
                <Badge badgeContent={4} color="error">
                    {/* <NotificationsIcon /> */}
                    <Avatar alt={currentUser?.name || ""}>CC</Avatar>
                </Badge>
                {/*
                 color="action"
                <Avatar sx={{ bgcolor: deepOrange[500] }}>CC</Avatar>
                */}
                <Typography sx={{ p: 2 }}>{currentUser?.name}</Typography>
            </IconButton>
            <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                // anchorOrigin={{
                //     vertical: 'top',
                //     horizontal: 'right',
                // }}
                keepMounted
                // transformOrigin={{
                //     vertical: 'top',
                //     horizontal: 'right',
                // }}
                open={Boolean(anchorEl)}
                onClose={handleClose}
            >
                <MenuItem onClick={handleClose}>Profile asonetuh aosentuha oseunthe </MenuItem>
                <MenuItem onClick={handleLogout}>Log out</MenuItem>
            </Menu>
        </Box>
    );
};

