//  https://codesandbox.io/s/material-ui-responsive-drawer-skqdw?resolutionWidth=1292&resolutionHeight=758&file=/src/App.js
import * as React from 'react';
import Link from "next/link"
import LabelIcon from '@mui/icons-material/Label';
import HomeIcon from '@mui/icons-material/Home';
import MenuIcon from '@mui/icons-material/Menu';
//import AccountCircle from '@mui/icons-material/AccountCircle';
import UserAppBarIcon from "src/core/components/UserAppBarIcon";
import { AppBar, Box, IconButton, Toolbar, Typography } from '@mui/material';
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';
import Button from '@mui/material/Button';

const Dashboard3 = ({ children }) => {

    return (
        <>
            <AppBar position="fixed">
                <Button variant="text">Text</Button>
                <Button variant="contained">Contained</Button>
                <Button variant="outlined">Outlined</Button>
                <Toolbar>
                    <Typography variant="h6" noWrap>
                        Responsive Drawer Example
                    </Typography>
                    <UserAppBarIcon></UserAppBarIcon>
                </Toolbar>
            </AppBar>
            {children}
            <Button variant="text">Text</Button>
            <Button variant="contained">Contained</Button>
            <Button variant="outlined">Outlined</Button>
            <hr />
            <Toolbar>
                <IconButton
                    color="inherit"
                    aria-label="open drawer"
                    edge="start"
                >
                    <MenuIcon />
                </IconButton>
                <Typography variant="h6" noWrap>
                    Responsive Drawer Example
                </Typography>
                <UserAppBarIcon></UserAppBarIcon>
            </Toolbar>
            <Button variant="text">Text</Button>
            <Button variant="contained">Contained</Button>
            <Button variant="outlined">Outlined</Button>
            <Button variant="text">Text</Button>
            <hr />
            <Button variant="contained">Contained</Button>
            <Button variant="outlined">Outlined</Button>
            <hr />
            <Button variant="text">Text</Button>
            <Button variant="contained">Contained</Button>
            <Button variant="outlined">Outlined</Button>
        </>
    );
}



export default Dashboard3;
