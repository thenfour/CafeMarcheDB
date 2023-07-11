//  https://codesandbox.io/s/material-ui-responsive-drawer-skqdw?resolutionWidth=1292&resolutionHeight=758&file=/src/App.js
import { useTheme } from "@mui/material/styles";
import Link from "next/link";
import * as React from 'react';
import { Info as InfoIcon, CalendarMonth as CalendarIcon, ExpandLess, ExpandMore, MusicNote as MusicNoteIcon } from '@mui/icons-material';
import { CalendarMonthOutlined as CalendarMonthOutlinedIcon, MusicNoteOutlined as MusicNoteOutlinedIcon } from '@mui/icons-material';
import HomeIcon from '@mui/icons-material/Home';
import MenuIcon from '@mui/icons-material/Menu';
import PersonIcon from '@mui/icons-material/Person';
import SecurityIcon from '@mui/icons-material/Security';
import { AppBar, Box, Collapse, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, ListSubheader, Toolbar, Typography, useMediaQuery } from '@mui/material';
import UserAppBarIcon from "src/core/components/UserAppBarIcon";
import { useRouter } from "next/router";

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


    const [editorsOpen, setEditorsOpen] = React.useState(true);

    const handleEditorsClick = () => {
        setEditorsOpen(!editorsOpen);
    };


    const [adminOpen, setAdminOpen] = React.useState(true);

    const handleAdminClick = () => {
        setAdminOpen(!adminOpen);
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
                <List component="nav"
                // subheader={
                //     <ListSubheader component="div" id="nested-list-subheader">
                //         Nested List Items
                //     </ListSubheader>
                // }
                >
                    <ListItemButton component={Link} href="/" selected={router.pathname == "/"}>
                        <ListItemIcon><HomeIcon /></ListItemIcon>
                        <ListItemText primary="Home" />
                    </ListItemButton>

                    <ListItemButton component={Link} href="/songs" selected={router.pathname == "/songs"}>
                        <ListItemIcon><MusicNoteIcon /></ListItemIcon>
                        <ListItemText primary="Songs" />
                    </ListItemButton>

                    <ListItemButton component={Link} href="/events" selected={router.pathname == "/events"}>
                        <ListItemIcon><CalendarIcon /></ListItemIcon>
                        <ListItemText primary="Agenda" />
                    </ListItemButton>

                    <ListItemButton component={Link} href="/info" selected={router.pathname == "/info"}>
                        <ListItemIcon><InfoIcon /></ListItemIcon>
                        <ListItemText primary="General Info" />
                    </ListItemButton>

                    <ListSubheader component="div" id="nested-list-subheader">Editing</ListSubheader>

                    <ListItemButton component={Link} href="/editSongs" selected={router.pathname == "/editSongs"}>
                        <ListItemIcon><MusicNoteOutlinedIcon /></ListItemIcon>
                        <ListItemText primary="Edit Songs" />
                    </ListItemButton>

                    <ListItemButton component={Link} href="/editEvents" selected={router.pathname == "/editEvents"}>
                        <ListItemIcon><CalendarMonthOutlinedIcon /></ListItemIcon>
                        <ListItemText primary="Edit Events" />
                    </ListItemButton>

                    <ListSubheader component="div" id="nested-list-subheader">Admin</ListSubheader>

                    {/* <ListItemButton onClick={() => { setAdminOpen(!adminOpen) }}>
                        <ListItemIcon>
                            <SecurityIcon />
                        </ListItemIcon>
                        <ListItemText primary="Admin" />
                        {adminOpen ? <ExpandMore /> : <ExpandLess />}
                    </ListItemButton> */}
                    {/* 
                    <ListSubheader component="div" onClick={() => { setAdminOpen(!adminOpen) }}>
                        <ListItemButton onClick={() => { setAdminOpen(!adminOpen) }}>
                            <ListItemIcon>
                                <SecurityIcon />
                            </ListItemIcon>
                            <ListItemText primary="Admin" />
                            {adminOpen ? <ExpandMore /> : <ExpandLess />}
                        </ListItemButton>
                    </ListSubheader>
 */}

                    {/* <Collapse in={adminOpen} unmountOnExit>
                        <List component="nav" disablePadding> */}
                    <ListItemButton component={Link} href="/users" selected={router.pathname == "/users"}>
                        <ListItemIcon><PersonIcon /></ListItemIcon>
                        <ListItemText primary="Users" />
                    </ListItemButton>
                    <ListItemButton component={Link} href="/roles" selected={router.pathname == "/roles"}>
                        <ListItemIcon><SecurityIcon /></ListItemIcon>
                        <ListItemText primary="Roles" />
                    </ListItemButton>
                    <ListItemButton component={Link} href="/instrumentGroups" selected={router.pathname == "/instrumentGroups"}>
                        <ListItemIcon><SecurityIcon /></ListItemIcon>
                        <ListItemText primary="Instrument Groups" />
                    </ListItemButton>
                    <ListItemButton component={Link} href="/permissions" selected={router.pathname == "/permissions"}>
                        <ListItemIcon><SecurityIcon /></ListItemIcon>
                        <ListItemText primary="Permissions" />
                    </ListItemButton>
                    <ListItemButton component={Link} href="/rolePermissions" selected={router.pathname == "/rolePermissions"}>
                        <ListItemIcon><SecurityIcon /></ListItemIcon>
                        <ListItemText primary="Permission matrix" />
                    </ListItemButton>
                    {/* </List>
                    </Collapse> */}



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
