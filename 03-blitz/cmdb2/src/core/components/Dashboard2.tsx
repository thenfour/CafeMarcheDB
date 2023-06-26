//  https://codesandbox.io/s/material-ui-responsive-drawer-skqdw?resolutionWidth=1292&resolutionHeight=758&file=/src/App.js
// import Drawer from "@material-ui/core/Drawer";
import { makeStyles, useTheme } from "@material-ui/core/styles";
// import useMediaQuery from "@material-ui/core/useMediaQuery";
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
import LabelIcon from '@mui/icons-material/Label';
import MenuIcon from '@mui/icons-material/Menu';
//import AccountCircle from '@mui/icons-material/AccountCircle';
import { AppBar, Box, Drawer, IconButton, List, ListItem, ListItemIcon, ListItemText, Toolbar, Typography, useMediaQuery } from '@mui/material';
import UserAppBarIcon from "src/core/components/UserAppBarIcon";
//import { useTheme } from "@emotion/react";

const drawerWidth = 200;

const useStyles = makeStyles(theme => ({
    root: {
        display: "flex",
    },
    appBar: {
        zIndex: theme.zIndex.drawer + 1
    },
    drawer: {
        flexShrink: 0,
        width: drawerWidth
    },
    drawerPaper: {
        width: drawerWidth
    },
    menuButton: {
        marginRight: theme.spacing(2),
        [theme.breakpoints.up("md")]: { // don't show menu button for small screens
            display: "none"
        }
    },
    toolbar: {
        ...theme.mixins.toolbar, // a dummy toolbar element pushing drawer icons down below the appbar.
        // [theme.breakpoints.down("sm")]: { // for small screens this padding is not desired because it's on top of the appbar.
        //     display: "none"
        // }
    },
    content: {
        flexGrow: 1,
        backgroundColor: theme.palette.background.default,
        padding: theme.spacing(3)
    },
    headerText: {
        flexGrow: 1,// make the header text consume most of the display pushing the avatar to the right.
    }
}));

const Dashboard2 = ({ children }) => {

    const theme = useTheme();
    const classes = useStyles();
    const isMdUp = useMediaQuery(theme.breakpoints.up("md"));
    //const isMdUp = true;
    //const classes = {};

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

    return (
        <Box className={classes.root}>
            <AppBar position="fixed" className={classes.appBar}>
                <Toolbar>
                    <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        edge="start"
                        onClick={toggleDrawer}
                        className={classes.menuButton}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" noWrap className={classes.headerText}>
                        Responsive Drawer Example
                    </Typography>
                    <UserAppBarIcon></UserAppBarIcon>
                </Toolbar>
            </AppBar>
            <Drawer
                className={classes.drawer}
                variant={isMdUp ? "permanent" : "temporary"}
                classes={{
                    paper: classes.drawerPaper
                }}
                anchor="left"
                open={open}
                onClose={toggleDrawer}
            >
                <div className={classes.toolbar} />
                <List>
                    <ListItem button key="home">
                        <ListItemIcon><HomeIcon /></ListItemIcon>
                        <ListItemText primary="Home" />
                    </ListItem>
                    <ListItem button key="aoeu">
                        <ListItemIcon><LabelIcon /></ListItemIcon>
                        <ListItemText primary="Users" />
                    </ListItem>
                    <ListItem button component={Link} href="/">
                        <ListItemText primary="home?" />
                    </ListItem>
                </List>
            </Drawer>
            <main className={classes.content}>
                <Toolbar />
                {children}
            </main>
        </Box>
    );
}



export default Dashboard2;
