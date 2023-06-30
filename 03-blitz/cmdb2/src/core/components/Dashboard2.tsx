//  https://codesandbox.io/s/material-ui-responsive-drawer-skqdw?resolutionWidth=1292&resolutionHeight=758&file=/src/App.js
// import Drawer from "@material-ui/core/Drawer";
import { useTheme } from "@mui/material/styles";
// import useMediaQuery from "@material-ui/core/useMediaQuery";
//import { css } from '@emotion/react';
import Link from "next/link";
import * as React from 'react';
//import CssBaseline from "@material-ui/core/CssBaseline";
// import AppBar from "@material-ui/core/AppBar";
// import Divider from "@material-ui/core/Divider";
// import IconButton from "@material-ui/core/IconButton";
// import List from "@material-ui/core/List";
// import ListItem from "@material-ui/core/ListItem";
// import ListItemIcon from "@material-ui/core/ListItemIcon";
// import ListItemText from "@material-ui/core/ListItemText";
// import Toolbar from "@material-ui/core/Toolbar";
// import Typography from "@material-ui/core/Typography";
import HomeIcon from '@mui/icons-material/Home';
import MenuIcon from '@mui/icons-material/Menu';
import PersonIcon from '@mui/icons-material/Person';
import SecurityIcon from '@mui/icons-material/Security';
//import AccountCircle from '@mui/icons-material/AccountCircle';
import { AppBar, Box, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Toolbar, Typography, useMediaQuery } from '@mui/material';
import UserAppBarIcon from "src/core/components/UserAppBarIcon";
//import { useTheme } from "@emotion/react";
import { useRouter } from "next/router"

const drawerWidth = 200;

const Dashboard2 = ({ children }) => {

    React.useEffect(() => {
        document.documentElement.style.setProperty('--drawer-paper-width', drawerWidth + "px");
    }, []);

    const theme = useTheme();
    const isMdUp = useMediaQuery(theme.breakpoints.up("md"));
    const router = useRouter();

    const [open, setOpen] = React.useState(false);

    const toggleDrawer = event => {
        if (
            event.type === "keydown" &&
            (event.key === "Tab" || event.key === "Shift")
        ) {
            return;
        }

        setOpen(!open);
    };

    const menuButtonSX = {
        marginRight: theme.spacing(2),
        display: isMdUp ? "none" : "inline-flex" // don't show menu button for small screens
    };

    return (
        <Box sx={{ display: "flex" }}>
            <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
                <Toolbar>
                    <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        edge="start"
                        onClick={toggleDrawer}
                        sx={menuButtonSX}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
                        Café Marché Backstage 2
                    </Typography>
                    <UserAppBarIcon></UserAppBarIcon>
                </Toolbar>
            </AppBar>
            <Drawer
                sx={{
                    flexShrink: 0,
                    width: drawerWidth
                }}
                variant={isMdUp ? "permanent" : "temporary"}
                anchor="left"
                open={open}
                onClose={toggleDrawer}
            >
                <Box sx={{ ...theme.mixins.toolbar }} />
                <List component="nav">
                    <ListItemButton component={Link} href="/" selected={router.pathname == "/"}>
                        <ListItemIcon><HomeIcon /></ListItemIcon>
                        <ListItemText primary="Home" />
                    </ListItemButton>
                    <ListItemButton component={Link} href="/users" selected={router.pathname == "/users"}>
                        <ListItemIcon><PersonIcon /></ListItemIcon>
                        <ListItemText primary="Manage Users" />
                    </ListItemButton>
                    <ListItemButton component={Link} href="/roles" selected={router.pathname == "/roles"}>
                        <ListItemIcon><SecurityIcon /></ListItemIcon>
                        <ListItemText primary="Manage Roles" />
                    </ListItemButton>
                </List>
            </Drawer>
            <Box sx={{
                flexGrow: 1,
                backgroundColor: theme.palette.background.default,
                padding: theme.spacing(3)

            }}>
                <Toolbar />
                {children}
            </Box>
        </Box>
    );
}

export default Dashboard2;
