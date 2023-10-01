//  https://codesandbox.io/s/material-ui-responsive-drawer-skqdw?resolutionWidth=1292&resolutionHeight=758&file=/src/App.js
// https://mui.com/material-ui/react-app-bar/#app-bar-with-a-primary-search-field
import { useSession } from "@blitzjs/auth";
import { useMutation } from "@blitzjs/rpc";
import {
    CalendarMonthOutlined as CalendarMonthOutlinedIcon,
    Info as InfoIcon,
    MusicNote as MusicNoteIcon,
    MusicNoteOutlined as MusicNoteOutlinedIcon,
    Settings as SettingsIcon
} from '@mui/icons-material';
import CommentIcon from '@mui/icons-material/Comment';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import HomeIcon from '@mui/icons-material/Home';
import MenuIcon from '@mui/icons-material/Menu';
import MoreIcon from '@mui/icons-material/MoreVert';
import PersonIcon from '@mui/icons-material/Person';
import SearchIcon from '@mui/icons-material/Search';
import SecurityIcon from '@mui/icons-material/Security';
import { AppBar, Avatar, Badge, Box, Button, Divider, Drawer, IconButton, InputBase, List, ListItemButton, ListItemIcon, ListItemText, ListSubheader, Menu, MenuItem, Toolbar, Typography, useMediaQuery } from '@mui/material';
import { alpha, styled, useTheme } from "@mui/material/styles";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import Link from "next/link";
import { useRouter } from "next/router";
import * as React from 'react';
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import logout from "src/auth/mutations/logout";
import stopImpersonating from "src/auth/mutations/stopImpersonating";
import CollectionsIcon from '@mui/icons-material/Collections';

const drawerWidth = 300;


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

const AppBarUserIcon_MenuItems = () => {
    const [logoutMutation] = useMutation(logout);
    return <>
        <MenuItem component={Link} href='/backstage/profile'>Your profile</MenuItem>
        <MenuItem onClick={async () => {
            await logoutMutation();
        }}>Log out</MenuItem>
    </>;
};

const AppBarUserIcon_Desktop = () => {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const [currentUser] = useCurrentUser();

    const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
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
                    <Avatar alt={currentUser?.name || ""}>CC</Avatar>
                </Badge>
                <Typography sx={{ p: 2 }}>{currentUser?.name}</Typography>
            </IconButton>
            <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                keepMounted
                open={Boolean(anchorEl)}
                onClose={() => {
                    setAnchorEl(null)
                }}
            >
                <AppBarUserIcon_MenuItems />
            </Menu>
        </Box>
    );
};

const AppBarUserIcon_Mobile = () => {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

    const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    return (
        <Box>
            <IconButton
                size="large"
                aria-label="show more"
                aria-haspopup="true"
                onClick={handleMenu}
                color="inherit"
            >
                <MoreIcon /> { /* three dots icon */}
            </IconButton>
            <Menu
                anchorEl={anchorEl}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
                keepMounted
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
            >
                <AppBarUserIcon_MenuItems />
            </Menu>
        </Box>
    );
};



interface PrimarySearchAppBarProps {
    onClickToggleDrawer: (event: any) => void,
}

const PrimarySearchAppBar = (props: PrimarySearchAppBarProps) => {
    const theme = useTheme();

    const session = useSession();
    let backgroundColor: string | undefined = undefined;
    if (session.impersonatingFromUserId != null) {
        backgroundColor = "#844";
    }

    const [stopImpersonatingMutation] = useMutation(stopImpersonating);

    const onClickStopImpersonating = () => {
        stopImpersonatingMutation();
    };

    return (
        <>
            <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1, backgroundColor: backgroundColor }}>
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
                    {(session.impersonatingFromUserId != null) && (
                        <Button size="small" variant="contained" onClick={onClickStopImpersonating}>Stop impersonating</Button>
                    )}
                    <Box sx={{ flexGrow: 1 }} />{/* spacing to separate left from right sides */}
                    <Box sx={{ display: { xs: 'none', md: 'flex' } }}>
                        <AppBarUserIcon_Desktop />
                    </Box>
                    <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
                        <AppBarUserIcon_Mobile />
                    </Box>
                </Toolbar>
            </AppBar>
        </>
    );
}; // PrimarySearchAppBar

interface MenuItemDivider {
    type: "divider";
};
interface MenuItemSectionHeader {
    type: "sectionHeader";
    sectionName: string;
};
interface MenuItemLink {
    type: "link";
    linkCaption: string;
    path: string;
    renderIcon: () => React.ReactElement;
};

type MenuItem = MenuItemDivider | MenuItemSectionHeader | MenuItemLink;

interface MenuItemComponentProps {
    item: MenuItem
};

const MenuItemComponent = (props: MenuItemComponentProps) => {
    const router = useRouter();
    if (props.item.type === "divider") {
        return <Divider />;
    }
    if (props.item.type === "sectionHeader") {
        return (<ListSubheader component="div">
            <Typography variant="button" noWrap>{props.item.sectionName}</Typography>
        </ListSubheader>);
    }
    if (props.item.type === "link") {
        return (<ListItemButton component={Link} href={props.item.path!} selected={router.pathname == props.item.path}>
            {props.item.renderIcon && <ListItemIcon>{props.item.renderIcon()}</ListItemIcon>}
            <ListItemText primary={props.item.linkCaption} />
        </ListItemButton>);
    }
    return <>??</>;
};

const gMenuItems: MenuItem[] = [
    { type: "link", path: "/backstage", linkCaption: "Home", renderIcon: () => <HomeIcon /> },
    { type: "link", path: "/backstage/events", linkCaption: "Events", renderIcon: () => <CalendarMonthOutlinedIcon /> },
    { type: "link", path: "/backstage/eventList", linkCaption: "Event List", renderIcon: () => <CalendarMonthOutlinedIcon /> },
    { type: "link", path: "/backstage/songs", linkCaption: "Songs", renderIcon: () => <MusicNoteOutlinedIcon /> },
    { type: "link", path: "/backstage/info", linkCaption: "Info", renderIcon: () => <InfoIcon /> },
    { type: "link", path: "/backstage/profile", linkCaption: "Your Profile", renderIcon: () => <PersonIcon /> },

    { type: "divider" },
    { type: "sectionHeader", sectionName: "Admin Auth" },
    { type: "link", path: "/backstage/users", linkCaption: "Users", renderIcon: () => <PersonIcon /> },
    { type: "link", path: "/backstage/roles", linkCaption: "Roles", renderIcon: () => <SecurityIcon /> },
    { type: "link", path: "/backstage/permissions", linkCaption: "Permissions", renderIcon: () => <SecurityIcon /> },
    { type: "link", path: "/backstage/rolePermissions", linkCaption: "Permission matrix", renderIcon: () => <SecurityIcon /> },

    { type: "divider" },
    { type: "sectionHeader", sectionName: "Admin Instruments" },
    { type: "link", path: "/backstage/instruments", linkCaption: "Instruments", renderIcon: () => <MusicNoteIcon /> },
    { type: "link", path: "/backstage/userInstruments", linkCaption: "User Instruments", renderIcon: () => <MusicNoteIcon /> },
    { type: "divider" },
    { type: "link", path: "/backstage/instrumentFunctionalGroups", linkCaption: "Functional Groups", renderIcon: () => <MusicNoteIcon /> },
    { type: "link", path: "/backstage/instrumentTags", linkCaption: "Tags", renderIcon: () => <MusicNoteIcon /> },

    { type: "divider" },
    { type: "sectionHeader", sectionName: "Admin Songs" },
    { type: "link", path: "/backstage/editSongs", linkCaption: "Songs", renderIcon: () => <MusicNoteIcon /> },
    { type: "link", path: "/backstage/editSongCredits", linkCaption: "Song Credits", renderIcon: () => <MusicNoteIcon /> },
    { type: "link", path: "/backstage/editSongComments", linkCaption: "Song Comments", renderIcon: () => <MusicNoteIcon /> },
    { type: "divider" },
    { type: "link", path: "/backstage/editSongTags", linkCaption: "Song Tags", renderIcon: () => <MusicNoteIcon /> },
    { type: "link", path: "/backstage/editSongCreditTypes", linkCaption: "Credit Types", renderIcon: () => <MusicNoteIcon /> },

    { type: "divider" },
    { type: "sectionHeader", sectionName: "Admin Events" },
    { type: "link", path: "/backstage/editEvents", linkCaption: "Events", renderIcon: () => <CalendarMonthOutlinedIcon /> },
    { type: "link", path: "/backstage/editEventSegments", linkCaption: "Event Segments", renderIcon: () => <CalendarMonthOutlinedIcon /> },
    { type: "divider" },
    { type: "link", path: "/backstage/editEventUserResponses", linkCaption: "Event User Responses", renderIcon: () => <CommentIcon /> },
    { type: "link", path: "/backstage/editEventComments", linkCaption: "Event comments", renderIcon: () => <CommentIcon /> },
    { type: "divider" },
    { type: "link", path: "/backstage/editEventSongLists", linkCaption: "Event Song Lists", renderIcon: () => <FormatListNumberedIcon /> },
    { type: "link", path: "/backstage/editEventSongListSongs", linkCaption: "Event Song List Songs", renderIcon: () => <FormatListNumberedIcon /> },
    { type: "divider" },
    { type: "link", path: "/backstage/editEventTypes", linkCaption: "Event Types", renderIcon: () => <SettingsIcon /> },
    { type: "link", path: "/backstage/editEventStatuses", linkCaption: "Event Statuses", renderIcon: () => <SettingsIcon /> },
    { type: "link", path: "/backstage/editEventTags", linkCaption: "Event Tags", renderIcon: () => <SettingsIcon /> },
    { type: "link", path: "/backstage/editEventAttendances", linkCaption: "Attendance Options", renderIcon: () => <SettingsIcon /> },

    { type: "divider" },
    { type: "sectionHeader", sectionName: "Admin Settings" },
    { type: "link", path: "/backstage/settings", linkCaption: "Settings", renderIcon: () => <SettingsIcon /> },
    { type: "link", path: "/backstage/coloreditor", linkCaption: "Color Editor", renderIcon: () => <SettingsIcon /> },
    { type: "link", path: "/backstage/gallery", linkCaption: "Component Gallery", renderIcon: () => <CollectionsIcon /> },
]

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

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box sx={{ display: "flex" }} className="CMDashboard2">
                <PrimarySearchAppBar onClickToggleDrawer={toggleDrawer}></PrimarySearchAppBar>
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
                        {
                            gMenuItems.map((item, index) => <MenuItemComponent key={index} item={item} />)
                        }
                        <li style={{ height: 100 }}></li>{/* gives space at the bottom of the nav, which helps make things accessible if the bottom of the window is covered (e.g. snackbar message or error message is visible) */}
                    </List>
                </Drawer>
                <Box sx={{
                    flexGrow: 1,
                    backgroundColor: theme.palette.background.default,
                    padding: theme.spacing(3)
                }}
                    className="mainContentBackdrop"
                >
                    <Toolbar />
                    {children}
                </Box>
            </Box>
        </LocalizationProvider>
    );
}

export default Dashboard2;
