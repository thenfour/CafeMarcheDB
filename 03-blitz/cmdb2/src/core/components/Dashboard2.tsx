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
import { gIconMap } from "../db3/components/IconSelectDialog";
import { Permission } from "shared/permissions";
import { CMAuthorize } from "types";
import { API } from "../db3/clientAPI";
import { assert } from "blitz";

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
                <Avatar alt={currentUser?.name || ""}>
                    {gIconMap.Person()}
                </Avatar>
                {/* <Badge badgeContent={4} color="error">
                </Badge> */}
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
    const router = useRouter();

    const session = useSession();
    let backgroundColor: string | undefined = undefined;
    if (session.impersonatingFromUserId != null) {
        backgroundColor = "#844";
    }

    const [stopImpersonatingMutation] = useMutation(stopImpersonating);

    const onClickStopImpersonating = async () => {
        await stopImpersonatingMutation();
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
                        <a href={"/backstage"} className="logo">Café Marché Backstage</a>
                    </Typography>

                    {/* {(session.userId != null) && <Search>
                        <SearchIconWrapper>
                            <SearchIcon />
                        </SearchIconWrapper>
                        <StyledInputBase
                            placeholder="Search…"
                            inputProps={{ 'aria-label': 'search' }}
                        />
                    </Search>} */}
                    {(session.impersonatingFromUserId != null) && (
                        <Button size="small" variant="contained" onClick={onClickStopImpersonating}>Stop impersonating</Button>
                    )}
                    <Box sx={{ flexGrow: 1 }} />{/* spacing to separate left from right sides */}

                    {(session.userId != null) && <>
                        <Box sx={{ display: { xs: 'none', md: 'flex' } }}>
                            <AppBarUserIcon_Desktop />
                        </Box>
                        <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
                            <AppBarUserIcon_Mobile />
                        </Box>
                    </>}
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



export enum NavRealm {
    events = "events",
    songs = "songs",
};



interface MenuItemLink {
    type: "link";
    permission: Permission;
    className?: string;
    linkCaption: string;
    path: string;
    realm?: NavRealm;
    renderIcon: () => React.ReactElement;
};

type MenuItemSpec = MenuItemDivider | MenuItemSectionHeader | MenuItemLink;

interface MenuItemGroup {
    name: string | null;
    className?: string;
    items: MenuItemSpec[];
};

type MenuItemAndGroup = { group: MenuItemGroup, item: MenuItemSpec };

interface MenuItemComponentProps {
    item: MenuItemAndGroup;
    realm: NavRealm | undefined;
};

const MenuItemComponent = (props: MenuItemComponentProps) => {
    const router = useRouter();
    if (props.item.item.type === "divider") {
        return <Divider className={`${props.item.group.className} divider`} />;
    }
    if (props.item.item.type === "sectionHeader") {
        return (<ListSubheader component="div" className={`${props.item.group.className} sectionHeader`}>
            <Typography variant="button" noWrap>{props.item.item.sectionName}</Typography>
        </ListSubheader>);
    }
    if (props.item.item.type === "link") {

        let selected = false;
        if (router.pathname == props.item.item.path) selected = true;
        if ((props.item.item.realm !== undefined) && (props.realm !== undefined) && (props.item.item.realm === props.realm)) selected = true;

        return (<ListItemButton component={Link} href={props.item.item.path!} selected={selected} className={`linkMenuItem ${props.item.group.className} ${props.item.item.className}`}>
            {props.item.item.renderIcon && <ListItemIcon>{props.item.item.renderIcon()}</ListItemIcon>}
            <ListItemText primary={props.item.item.linkCaption} />
        </ListItemButton>);
    }
    return <>??</>;
};

const gMenuItemGroups: MenuItemGroup[] = [
    {
        name: "Public",
        className: "public",
        items: [
            { type: "link", path: "/", linkCaption: "Homepage", renderIcon: () => gIconMap.Public(), permission: Permission.visibility_public, },
            { type: "link", path: "/backstage/frontpagegallery", linkCaption: "Photo gallery", renderIcon: () => gIconMap.Image(), permission: Permission.edit_public_homepage },
        ],
    },
    {
        name: "Backstage",
        className: "backstage",
        items: [
            { type: "link", path: "/backstage", linkCaption: "Home", renderIcon: () => <HomeIcon />, permission: Permission.login },
            { type: "link", path: "/backstage/events", realm: NavRealm.events, linkCaption: "Events", renderIcon: () => <CalendarMonthOutlinedIcon />, permission: Permission.view_events },
            { type: "link", path: "/backstage/songs", realm: NavRealm.songs, linkCaption: "Songs", renderIcon: () => <MusicNoteOutlinedIcon />, permission: Permission.view_songs },
            { type: "link", path: "/backstage/info", linkCaption: "Info", renderIcon: () => <InfoIcon />, permission: Permission.login },
            { type: "link", path: "/backstage/profile", linkCaption: "Your Profile", renderIcon: () => <PersonIcon />, permission: Permission.login },
        ],
    },
    {
        name: "Admin Users",
        className: "admin users",
        items: [
            { type: "link", path: "/backstage/users", linkCaption: "Users", renderIcon: () => <PersonIcon />, permission: Permission.manage_users },
            { type: "link", path: "/backstage/editUserTags", linkCaption: "Tags", renderIcon: () => gIconMap.Tag(), permission: Permission.admin_users },
            { type: "link", path: "/backstage/roles", linkCaption: "Roles", renderIcon: () => <SecurityIcon />, permission: Permission.admin_users },
            { type: "link", path: "/backstage/permissions", linkCaption: "Permissions", renderIcon: () => <SecurityIcon />, permission: Permission.admin_users },
            { type: "link", path: "/backstage/rolePermissions", linkCaption: "Permission matrix", renderIcon: () => <SecurityIcon />, permission: Permission.admin_users },
        ],
    },

    {
        name: "Admin Instruments",
        className: "admin instruments",
        items: [
            { type: "link", path: "/backstage/instruments", linkCaption: "Instruments", renderIcon: () => <MusicNoteIcon />, permission: Permission.manage_instruments },
            { type: "link", path: "/backstage/userInstruments", linkCaption: "User Instruments", renderIcon: () => <MusicNoteIcon />, permission: Permission.manage_instruments },
        ],
    },
    {
        name: null,
        className: "admin instruments",
        items: [
            { type: "link", path: "/backstage/instrumentFunctionalGroups", linkCaption: "Functional Groups", renderIcon: () => <MusicNoteIcon />, permission: Permission.manage_instruments },
            { type: "link", path: "/backstage/instrumentTags", linkCaption: "Tags", renderIcon: () => gIconMap.Tag(), permission: Permission.manage_instruments },
        ],
    },

    {
        name: "Admin Songs",
        className: "admin songs",
        items: [
            { type: "link", path: "/backstage/editSongs", linkCaption: "Songs", renderIcon: () => <MusicNoteIcon />, permission: Permission.manage_songs },
            { type: "link", path: "/backstage/editSongCredits", linkCaption: "Song Credits", renderIcon: () => <MusicNoteIcon />, permission: Permission.manage_songs },
            { type: "link", path: "/backstage/editSongComments", linkCaption: "Song Comments", renderIcon: () => <MusicNoteIcon />, permission: Permission.manage_songs },
        ],
    },
    {
        name: null,
        className: "admin songs",
        items: [
            { type: "link", path: "/backstage/editSongTags", linkCaption: "Song Tags", renderIcon: () => gIconMap.Tag(), permission: Permission.manage_songs },
            { type: "link", path: "/backstage/editSongCreditTypes", linkCaption: "Credit Types", renderIcon: () => <MusicNoteIcon />, permission: Permission.manage_songs },
        ],
    },

    {
        name: "Admin Events",
        className: "admin events",
        items: [
            { type: "link", path: "/backstage/editEvents", linkCaption: "Events", renderIcon: () => <CalendarMonthOutlinedIcon />, permission: Permission.manage_events },
            { type: "link", path: "/backstage/editEventSegments", linkCaption: "Event Segments", renderIcon: () => <CalendarMonthOutlinedIcon />, permission: Permission.manage_events },
        ],
    },
    {
        name: null,
        className: "admin events",
        items: [
            { type: "link", path: "/backstage/editEventSongLists", linkCaption: "Event Song Lists", renderIcon: () => <FormatListNumberedIcon />, permission: Permission.manage_events },
            { type: "link", path: "/backstage/editEventSongListSongs", linkCaption: "Event Song List Songs", renderIcon: () => <FormatListNumberedIcon />, permission: Permission.manage_events },
        ],
    },
    {
        name: null,
        className: "admin events",
        items: [
            { type: "link", path: "/backstage/editEventUserResponses", linkCaption: "Event User Responses", renderIcon: () => <CommentIcon />, permission: Permission.manage_events },
            { type: "link", path: "/backstage/editEventSegmentUserResponses", linkCaption: "Segment User Responses", renderIcon: () => <CommentIcon />, permission: Permission.manage_events },
        ],
    },
    {
        name: null,
        className: "admin events",
        items: [
            { type: "link", path: "/backstage/editEventTypes", linkCaption: "Event Types", renderIcon: () => <SettingsIcon />, permission: Permission.manage_events },
            { type: "link", path: "/backstage/editEventStatuses", linkCaption: "Event Statuses", renderIcon: () => <SettingsIcon />, permission: Permission.manage_events },
            { type: "link", path: "/backstage/editEventTags", linkCaption: "Event Tags", renderIcon: () => gIconMap.Tag(), permission: Permission.manage_events },
            { type: "link", path: "/backstage/editEventAttendances", linkCaption: "Attendance Options", renderIcon: () => <SettingsIcon />, permission: Permission.manage_events },

        ],
    },

    {
        name: "Admin Files",
        className: "admin files",
        items: [
            { type: "link", path: "/backstage/editFileTags", linkCaption: "File Tags", renderIcon: gIconMap.Tag, permission: Permission.admin_files },
            { type: "link", path: "/backstage/editFiles", linkCaption: "Files", renderIcon: gIconMap.AttachFile, permission: Permission.admin_files },
            { type: "link", path: "/backstage/editFrontpageGalleryItems", linkCaption: "Front page gallery", renderIcon: gIconMap.AttachFile, permission: Permission.admin_files },
        ],
    },
    {
        name: "Admin Settings",
        className: "admin settings",
        items: [
            { type: "link", path: "/backstage/settings", linkCaption: "Settings", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/gallery", linkCaption: "Component Gallery", renderIcon: () => <CollectionsIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/colorEditor2", linkCaption: "Color Editor", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
        ],
    },
];

const Dashboard2 = ({ navRealm, children }: React.PropsWithChildren<{ navRealm?: NavRealm; }>) => {

    const session = useSession();
    //session.permissions

    React.useEffect(() => {
        document.documentElement.style.setProperty('--drawer-paper-width', drawerWidth + "px");
    }, []);

    const theme = useTheme();
    //console.log(theme.direction);
    //const isPortrait = useMediaQuery({ orientation: 'portrait' }, true);
    //useResponsiveQuery();
    //console.log(`isportrait: ${isPortrait}`);

    const isMdUp = useMediaQuery(theme.breakpoints.up("md"));
    //const router = useRouter();

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

    // flatten our list of menu groups & items based on permissions.
    const menuItems: { group: MenuItemGroup, item: MenuItemSpec }[] = [];
    for (let iGroup = 0; iGroup < gMenuItemGroups.length; ++iGroup) {
        const g = gMenuItemGroups[iGroup]!;
        let firstItemInGroup: boolean = true;
        for (let iItem = 0; iItem < g.items.length; ++iItem) {
            const item = g.items[iItem] as MenuItemLink;
            assert(g.items[iItem]?.type === "link", "only link menu items should be added here; other types are created dynamically");
            if (API.users.isAuthorizedFor(session, item.permission)) {
                // add it to the flat list.
                if (firstItemInGroup) {
                    if (menuItems.length) {
                        // add a divider because we know other items are already there.
                        menuItems.push({
                            group: g,
                            item: {
                                type: "divider",
                            }
                        });
                    }
                    // add the group heading
                    if (g.name) {
                        menuItems.push({
                            group: g,
                            item: {
                                type: "sectionHeader",
                                sectionName: g.name,
                            }
                        });
                    }
                    firstItemInGroup = false;
                }
                menuItems.push({
                    group: g,
                    item,
                });
            }
        }
    }

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
                    <List component="nav" className="CMMenu">
                        {
                            menuItems.map((item, index) => <MenuItemComponent key={index} item={item} realm={navRealm} />)
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
                    <React.Suspense>
                        {children}
                    </React.Suspense>
                </Box>
            </Box>
        </LocalizationProvider>
    );
}

export default Dashboard2;
