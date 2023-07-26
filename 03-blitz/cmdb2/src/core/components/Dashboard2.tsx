//  https://codesandbox.io/s/material-ui-responsive-drawer-skqdw?resolutionWidth=1292&resolutionHeight=758&file=/src/App.js
// https://mui.com/material-ui/react-app-bar/#app-bar-with-a-primary-search-field
import { useTheme } from "@mui/material/styles";
import Link from "next/link";
import * as React from 'react';
import {
    Info as InfoIcon, CalendarMonth as CalendarIcon, ExpandLess, ExpandMore, MusicNote as MusicNoteIcon, AccountCircle,
    Settings as SettingsIcon,
} from '@mui/icons-material';
import { CalendarMonthOutlined as CalendarMonthOutlinedIcon, MusicNoteOutlined as MusicNoteOutlinedIcon } from '@mui/icons-material';
import HomeIcon from '@mui/icons-material/Home';
import MenuIcon from '@mui/icons-material/Menu';
import PersonIcon from '@mui/icons-material/Person';
import SearchIcon from '@mui/icons-material/Search';
import MailIcon from '@mui/icons-material/Mail';
import SecurityIcon from '@mui/icons-material/Security';
import NotificationsIcon from '@mui/icons-material/Notifications';
import MoreIcon from '@mui/icons-material/MoreVert';
import { AppBar, Badge, Box, Collapse, Drawer, IconButton, InputBase, List, ListItemButton, ListItemIcon, ListItemText, ListSubheader, Menu, MenuItem, Toolbar, Typography, useMediaQuery } from '@mui/material';
import UserAppBarIcon from "src/core/components/UserAppBarIcon";
import { useRouter } from "next/router";
import { styled, alpha } from '@mui/material/styles';

const drawerWidth = 200;


const Search = styled('div')(({ theme }) => ({
    position: 'relative',
    borderRadius: theme.shape.borderRadius,
    backgroundColor: alpha(theme.palette.common.white, 0.15),
    '&:hover': {
        backgroundColor: alpha(theme.palette.common.white, 0.25),
    },
    marginRight: theme.spacing(2),
    marginLeft: 0,
    width: '100%',
    [theme.breakpoints.up('sm')]: {
        marginLeft: theme.spacing(3),
        width: 'auto',
    },
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
    padding: theme.spacing(0, 2),
    height: '100%',
    position: 'absolute',
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
    color: 'inherit',
    '& .MuiInputBase-input': {
        padding: theme.spacing(1, 1, 1, 0),
        // vertical padding + font size from searchIcon
        paddingLeft: `calc(1em + ${theme.spacing(4)})`,
        transition: theme.transitions.create('width'),
        width: '100%',
        [theme.breakpoints.up('md')]: {
            width: '20ch',
        },
    },
}));



interface PrimarySearchAppBarProps {
    onClickToggleDrawer: (event: any) => void,
}

const PrimarySearchAppBar = (props: PrimarySearchAppBarProps) => {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const [mobileMoreAnchorEl, setMobileMoreAnchorEl] =
        React.useState<null | HTMLElement>(null);

    const theme = useTheme();

    const isMenuOpen = Boolean(anchorEl);
    const isMobileMenuOpen = Boolean(mobileMoreAnchorEl);

    const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMobileMenuClose = () => {
        setMobileMoreAnchorEl(null);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        handleMobileMenuClose();
    };

    const handleMobileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setMobileMoreAnchorEl(event.currentTarget);
    };

    const menuId = 'primary-search-account-menu';
    const renderMenu = (
        <Menu
            anchorEl={anchorEl}
            anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
            }}
            id={menuId}
            keepMounted
            transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
            }}
            open={isMenuOpen}
            onClose={handleMenuClose}
        >
            <MenuItem onClick={handleMenuClose}>Profile</MenuItem>
            <MenuItem onClick={handleMenuClose}>My account</MenuItem>
        </Menu>
    );

    const mobileMenuId = 'primary-search-account-menu-mobile';
    const renderMobileMenu = (
        <Menu
            anchorEl={mobileMoreAnchorEl}
            anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
            }}
            id={mobileMenuId}
            keepMounted
            transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
            }}
            open={isMobileMenuOpen}
            onClose={handleMobileMenuClose}
        >
            <MenuItem>
                <IconButton size="large" aria-label="show 4 new mails" color="inherit">
                    <Badge badgeContent={4} color="error">
                        <MailIcon />
                    </Badge>
                </IconButton>
                <p>Messages</p>
            </MenuItem>
            <MenuItem>
                <IconButton
                    size="large"
                    aria-label="show 17 new notifications"
                    color="inherit"
                >
                    <Badge badgeContent={17} color="error">
                        <NotificationsIcon />
                    </Badge>
                </IconButton>
                <p>Notifications</p>
            </MenuItem>
            <MenuItem onClick={handleProfileMenuOpen}>
                <IconButton
                    size="large"
                    aria-label="account of current user"
                    aria-controls="primary-search-account-menu"
                    aria-haspopup="true"
                    color="inherit"
                >
                    <AccountCircle />
                </IconButton>
                <p>Profile</p>
            </MenuItem>
        </Menu>
    );

    return (
        <>
            <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
                <Toolbar>
                    <IconButton
                        size="large"
                        edge="start"
                        color="inherit"
                        aria-label="toggle drawer"
                        sx={{ mr: 2, display: { xs: 'flex', md: 'none' } }}
                        onClick={props.onClickToggleDrawer}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography
                        variant="h6"
                        noWrap
                        component="div"
                        sx={{ display: { xs: 'none', sm: 'block' } }}
                    >
                        Café Marché Backstage
                    </Typography>
                    <Search>
                        <SearchIconWrapper>
                            <SearchIcon />
                        </SearchIconWrapper>
                        <StyledInputBase
                            placeholder="Search…"
                            inputProps={{ 'aria-label': 'search' }}
                        />
                    </Search>
                    <Box sx={{ flexGrow: 1 }} />
                    <Box sx={{ display: { xs: 'none', md: 'flex' } }}>
                        {/* <IconButton size="large" aria-label="show 4 new mails" color="inherit">
                            <Badge badgeContent={4} color="error">
                                <MailIcon />
                            </Badge>
                        </IconButton> */}
                        {/* <IconButton
                            size="large"
                            aria-label="show 17 new notifications"
                            color="inherit"
                        >
                            <Badge badgeContent={17} color="error">
                                <NotificationsIcon />
                            </Badge>
                        </IconButton> */}
                        <UserAppBarIcon></UserAppBarIcon>
                        {/* <IconButton
                            size="large"
                            edge="end"
                            aria-label="account of current user"
                            aria-controls={menuId}
                            aria-haspopup="true"
                            onClick={handleProfileMenuOpen}
                            color="inherit"
                        >
                            <AccountCircle />
                        </IconButton> */}
                    </Box>
                    <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
                        <IconButton
                            size="large"
                            aria-label="show more"
                            aria-controls={mobileMenuId}
                            aria-haspopup="true"
                            onClick={handleMobileMenuOpen}
                            color="inherit"
                        >
                            <MoreIcon />
                        </IconButton>
                    </Box>
                </Toolbar>
            </AppBar>
            {renderMobileMenu}
            {renderMenu}
        </>
    );
}; // PrimarySearchAppBar




const OtherAppBar = () => {
    const theme = useTheme();

    const toggleDrawer = event => {
        // if (
        //     event.type === "keydown" &&
        //     (event.key === "Tab" || event.key === "Shift")
        // ) {
        //     return;
        // }

        // setOpen(!open);
    };

    const isMdUp = useMediaQuery(theme.breakpoints.up("md"));

    const menuButtonSX = {
        marginRight: theme.spacing(2),
        display: isMdUp ? "none" : "inline-flex" // don't show menu button for small screens
    };


    return (
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
                <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" noWrap>
                        Café Marché Backstage 2
                    </Typography>

                </Box>

                <UserAppBarIcon></UserAppBarIcon>
            </Toolbar>
        </AppBar>);

};


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

            <PrimarySearchAppBar onClickToggleDrawer={toggleDrawer}></PrimarySearchAppBar>
            {/* <OtherAppBar></OtherAppBar> */}

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

                    <ListSubheader component="div" id="nested-list-subheader">
                        <Typography variant="button" noWrap>editing</Typography>
                    </ListSubheader>

                    <ListItemButton component={Link} href="/editSongs" selected={router.pathname == "/editSongs"}>
                        <ListItemIcon><MusicNoteOutlinedIcon /></ListItemIcon>
                        <ListItemText primary="Edit Songs" />
                    </ListItemButton>

                    <ListItemButton component={Link} href="/editEvents" selected={router.pathname == "/editEvents"}>
                        <ListItemIcon><CalendarMonthOutlinedIcon /></ListItemIcon>
                        <ListItemText primary="Edit Events" />
                    </ListItemButton>

                    <ListSubheader component="div" id="nested-list-subheader">
                        <Typography variant="button" noWrap>Admin</Typography>
                    </ListSubheader>

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
                    <ListItemButton component={Link} href="/settings" selected={router.pathname == "/settings"}>
                        <ListItemIcon><SettingsIcon /></ListItemIcon>
                        <ListItemText primary="Settings" />
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
