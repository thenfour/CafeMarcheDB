//  https://codesandbox.io/s/material-ui-responsive-drawer-skqdw?resolutionWidth=1292&resolutionHeight=758&file=/src/App.js
// https://mui.com/material-ui/react-app-bar/#app-bar-with-a-primary-search-field
import { useSession } from "@blitzjs/auth";
import { Routes } from "@blitzjs/next";
import { useMutation } from "@blitzjs/rpc";
import {
    CalendarMonthOutlined as CalendarMonthOutlinedIcon,
    MusicNote as MusicNoteIcon,
    MusicNoteOutlined as MusicNoteOutlinedIcon,
    Settings as SettingsIcon
} from '@mui/icons-material';
import CollectionsIcon from '@mui/icons-material/Collections';
import CommentIcon from '@mui/icons-material/Comment';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import HomeIcon from '@mui/icons-material/Home';
import MenuIcon from '@mui/icons-material/Menu';
import MoreIcon from '@mui/icons-material/MoreVert';
import PersonIcon from '@mui/icons-material/Person';
import SecurityIcon from '@mui/icons-material/Security';
import { AppBar, Avatar, Box, Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, ListSubheader, Menu, MenuItem, Toolbar, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from "@mui/material/styles";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { assert } from "blitz";
import Link from "next/link";
import { useRouter } from "next/router";
import * as React from 'react';
import * as DynMenu from "shared/dynMenuTypes";
import { Permission } from "shared/permissions";
import { slugify } from "shared/rootroot";
import { IsNullOrWhitespace } from "shared/utils";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import stopImpersonating from "src/auth/mutations/stopImpersonating";
import * as db3 from "src/core/db3/db3";
import { API } from "../db3/clientAPI";
import { gIconMap } from "../db3/components/IconSelectDialog";
import { GetICalRelativeURIForUserUpcomingEvents } from "../db3/shared/apiTypes";
import { DashboardContext, DashboardContextData, DashboardContextProvider } from "./DashboardContext";
import { MetronomeDialogButton } from "./Metronome";
import { AdminInspectObject } from "./CMCoreComponents";
import { getServerStartState } from "shared/serverStateBase";
import { formatMillisecondsToDHMS, formatTimeSpan } from "shared/time";
import { KeyValueDisplay } from "./CMCoreComponents2";

const drawerWidth = 260;


const AppBarUserIcon_MenuItems = () => {
    //const [logoutMutation] = useMutation(logout);
    const router = useRouter();
    //const [currentUser] = useCurrentUser();
    const sess = useSession();
    const showAdminControlsMutation = API.other.setShowingAdminControlsMutation.useToken();
    const isShowingAdminControls = !!sess.showAdminControls;
    const [currentUser] = useCurrentUser();

    const [stopImpersonatingMutation] = useMutation(stopImpersonating);

    const onClickStopImpersonating = async () => {
        await stopImpersonatingMutation();
    };

    const onClickShowAdminControls = async (showAdminControls: boolean) => {
        await showAdminControlsMutation.invoke({ showAdminControls });
    };

    return <>
        {(sess.impersonatingFromUserId != null) && (
            <MenuItem onClick={onClickStopImpersonating}>Stop impersonating</MenuItem>
        )}

        {(!!sess.isSysAdmin) && <>

            {isShowingAdminControls ?
                <MenuItem onClick={() => onClickShowAdminControls(false)}>Hide admin config {gIconMap.Settings()}</MenuItem>
                : <MenuItem onClick={() => onClickShowAdminControls(true)}>Show admin config {gIconMap.Settings()}</MenuItem>
            }

            <Divider /></>
        }

        {currentUser &&
            <MenuItem component={Link} href={GetICalRelativeURIForUserUpcomingEvents({ userAccessToken: currentUser.accessToken })} target="_blank" rel="noreferrer">
                {gIconMap.CalendarMonth()} Calendar feed (iCal format)
            </MenuItem>
        }

        <MenuItem component={Link} href='/backstage/profile'>Your profile</MenuItem>

        <MenuItem onClick={async () => {
            // just doing the mutation here will keep a bunch of app state; better to cleanly navigate to a simple logout page where we don't risk access exceptions.
            void router.push(Routes.LogoutPage());
        }}>
            Log out
        </MenuItem>


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
    //const showAdminControlsMutation = API.other.setShowingAdminControlsMutation.useToken();

    const session = useSession();
    //let backgroundColor: string | undefined = undefined;
    // if (session.impersonatingFromUserId != null) {
    //     backgroundColor = "#844";
    // }

    return (
        <>
            <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
                <Toolbar style={{ position: "relative" }}>
                    <div className={`headerIndicatorBar ${session.impersonatingFromUserId != null ? "impersonating" : "notImpersonating"}`}></div>
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
                        <a href={"/backstage"} className={`logo`}>Café Marché Backstage</a>
                    </Typography>

                    <MetronomeDialogButton />

                    {/* {(session.userId != null) && <Search>
                        <SearchIconWrapper>
                            <SearchIcon />
                        </SearchIconWrapper>
                        <StyledInputBase
                            placeholder="Search…"
                            inputProps={{ 'aria-label': 'search' }}
                        />
                    </Search>} */}
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

export enum NavRealm {
    backstageHome = "",
    events = "events",
    songs = "songs",
    YourProfile = "YourProfile",
    CustomLinks = "CustomLinks",
    MenuLinks = "MenuLinks",
};

interface MenuItemDivider {
    type: "divider";
};
interface MenuItemSectionHeader {
    type: "sectionHeader";
    sectionName: string;
};

interface MenuItemLink {
    type: "link";
    permission: Permission;
    className?: string;
    linkCaption: string;
    path: string;
    openInNewTab?: boolean;
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
        if (router.asPath == props.item.item.path) selected = true;
        if ((props.item.item.realm !== undefined) && (props.realm !== undefined) && (props.item.item.realm === props.realm)) selected = true;

        return (<ListItemButton
            component={Link}
            href={props.item.item.path}
            selected={selected}
            className={`linkMenuItem ${props.item.group.className} ${props.item.item.className}`}
            target={props.item.item.openInNewTab ? "_blank" : undefined}
        >
            {props.item.item.renderIcon && <ListItemIcon>{props.item.item.renderIcon()}</ListItemIcon>}
            <ListItemText primary={props.item.item.linkCaption} />
        </ListItemButton>);
    }
    return <>??</>;
};

const gMenuItemGroup1: MenuItemGroup[] = [
    {
        name: "Backstage",
        className: "backstage",
        items: [
            { type: "link", path: "/backstage", linkCaption: "Home", renderIcon: () => <HomeIcon />, permission: Permission.login },
            { type: "link", path: "/backstage/events", realm: NavRealm.events, linkCaption: "Events", renderIcon: () => <CalendarMonthOutlinedIcon />, permission: Permission.view_events_nonpublic },
            { type: "link", path: "/backstage/songs", realm: NavRealm.songs, linkCaption: "Songs", renderIcon: () => <MusicNoteOutlinedIcon />, permission: Permission.view_songs },
            // { type: "link", path: "/backstage/info", linkCaption: "Info", renderIcon: () => <InfoIcon />, permission: Permission.visibility_members },
            { type: "link", path: "/backstage/stats", linkCaption: "Stats", renderIcon: gIconMap.GraphicEq, permission: Permission.view_events },
            { type: "link", path: "/backstage/profile", linkCaption: "Your Profile", renderIcon: () => <PersonIcon />, permission: Permission.login },
        ],
    },
];
const gMenuItemGroup2: MenuItemGroup[] = [
    {
        name: "Configuration",
        className: "backstage",
        items: [
            { type: "link", path: "/backstage/menuLinks", linkCaption: "Manage Menu Links", renderIcon: gIconMap.Settings, permission: Permission.customize_menu },
            { type: "link", path: "/backstage/customLinks", linkCaption: "Custom Links", renderIcon: gIconMap.Link, permission: Permission.view_custom_links },
        ],
    },

    {
        name: "Public",
        className: "public",
        items: [
            { type: "link", path: "/", linkCaption: "Homepage", renderIcon: () => gIconMap.Public(), permission: Permission.visibility_public, },
            { type: "link", path: "/backstage/frontpagegallery", linkCaption: "Homepage Photos", renderIcon: () => gIconMap.Image(), permission: Permission.edit_public_homepage },
            { type: "link", path: "/backstage/frontpageEvents", linkCaption: "Homepage Agenda", renderIcon: () => <CalendarMonthOutlinedIcon />, permission: Permission.edit_public_homepage },
        ],
    },
    {
        name: "Admin Users",
        className: "admin users",
        items: [
            { type: "link", path: "/backstage/adminLogs", linkCaption: "Logs", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/users", linkCaption: "Users", renderIcon: () => <PersonIcon />, permission: Permission.admin_users },
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
            { type: "link", path: "/backstage/instruments", linkCaption: "Instruments", renderIcon: () => <MusicNoteIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/userInstruments", linkCaption: "User Instruments", renderIcon: () => <MusicNoteIcon />, permission: Permission.sysadmin },
        ],
    },
    {
        name: null,
        className: "admin instruments",
        items: [
            { type: "link", path: "/backstage/instrumentFunctionalGroups", linkCaption: "Functional Groups", renderIcon: () => <MusicNoteIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/instrumentTags", linkCaption: "Tags", renderIcon: () => gIconMap.Tag(), permission: Permission.sysadmin },
        ],
    },

    {
        name: "Admin Songs",
        className: "admin songs",
        items: [
            { type: "link", path: "/backstage/editSongs", linkCaption: "Songs", renderIcon: () => <MusicNoteIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/editSongCredits", linkCaption: "Song Credits", renderIcon: () => <MusicNoteIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/editSongComments", linkCaption: "Song Comments", renderIcon: () => <MusicNoteIcon />, permission: Permission.sysadmin },
        ],
    },
    {
        name: null,
        className: "admin songs",
        items: [
            { type: "link", path: "/backstage/editSongTags", linkCaption: "Song Tags", renderIcon: () => gIconMap.Tag(), permission: Permission.sysadmin },
            { type: "link", path: "/backstage/editSongCreditTypes", linkCaption: "Credit Types", renderIcon: () => <MusicNoteIcon />, permission: Permission.sysadmin },
        ],
    },

    {
        name: "Admin Events",
        className: "admin events",
        items: [
            { type: "link", path: "/backstage/editEvents", linkCaption: "Events", renderIcon: () => <CalendarMonthOutlinedIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/editEventSegments", linkCaption: "Event Segments", renderIcon: () => <CalendarMonthOutlinedIcon />, permission: Permission.sysadmin },
        ],
    },
    {
        name: null,
        className: "admin events",
        items: [
            { type: "link", path: "/backstage/editEventSongLists", linkCaption: "Event Song Lists", renderIcon: () => <FormatListNumberedIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/editEventSongListSongs", linkCaption: "Event Song List Songs", renderIcon: () => <FormatListNumberedIcon />, permission: Permission.sysadmin },
        ],
    },
    {
        name: null,
        className: "admin events",
        items: [
            { type: "link", path: "/backstage/editEventUserResponses", linkCaption: "Event User Responses", renderIcon: () => <CommentIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/editEventSegmentUserResponses", linkCaption: "Segment User Responses", renderIcon: () => <CommentIcon />, permission: Permission.sysadmin },
        ],
    },
    {
        name: null,
        className: "admin events",
        items: [
            { type: "link", path: "/backstage/editEventTypes", linkCaption: "Event Types", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/editEventStatuses", linkCaption: "Event Statuses", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/editEventTags", linkCaption: "Event Tags", renderIcon: () => gIconMap.Tag(), permission: Permission.sysadmin },
            { type: "link", path: "/backstage/editEventAttendances", linkCaption: "Attendance Options", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },

        ],
    },

    {
        name: "Admin Files",
        className: "admin files",
        items: [
            { type: "link", path: "/backstage/editFileTags", linkCaption: "File Tags", renderIcon: gIconMap.Tag, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/editFiles", linkCaption: "Files", renderIcon: gIconMap.AttachFile, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/editFrontpageGalleryItems", linkCaption: "Front page gallery", renderIcon: gIconMap.AttachFile, permission: Permission.sysadmin },
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

const FlattenMenuGroups = (dashboardContext: DashboardContextData, groups: MenuItemGroup[]): { group: MenuItemGroup, item: MenuItemSpec }[] => {
    const menuItems: { group: MenuItemGroup, item: MenuItemSpec }[] = [];

    for (let iGroup = 0; iGroup < groups.length; ++iGroup) {
        const g = groups[iGroup]!;
        let firstItemInGroup: boolean = true;
        for (let iItem = 0; iItem < g.items.length; ++iItem) {
            const item = g.items[iItem] as MenuItemLink;
            assert(g.items[iItem]?.type === "link", "only link menu items should be added here; other types are created dynamically");
            if (dashboardContext.isAuthorized(item.permission)) {
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

    return menuItems;
};

const DynMenuToMenuItem = (item: db3.MenuLinkPayload, dashboardContext: DashboardContextData): MenuItemLink | null => {
    let path = "";
    let openInNewTab = false;
    switch (item.linkType as keyof typeof DynMenu.DynamicMenuLinkType) {
        case "ExternalURL":
            openInNewTab = true;
            path = item.externalURI || "";
            break;
        case "Wiki":
            path = item.wikiSlug ? `/backstage/wiki/${slugify(item.wikiSlug)}` : "";
            break;
    }

    const pobj = dashboardContext.permission.getById(item.visiblePermissionId);

    return {
        type: "link",
        permission: (pobj?.name || Permission.never_grant) as Permission,
        className: item.itemCssClass,
        linkCaption: item.caption,
        renderIcon: item.iconName ? gIconMap[item.iconName] : undefined,
        path,
        openInNewTab,
    };
};

const FlattenDynMenuItems = (dashboardContext: DashboardContextData, items: db3.MenuLinkPayload[]): { group: MenuItemGroup, item: MenuItemSpec }[] => {
    const menuItems: { group: MenuItemGroup, item: MenuItemSpec }[] = [];
    let currentGroupName = "<never>";

    for (let iItem = 0; iItem < items.length; ++iItem) {
        const item = items[iItem]!;
        if (!dashboardContext.isAuthorizedPermissionId(item.visiblePermissionId)) continue;
        const menuItem = DynMenuToMenuItem(item, dashboardContext);
        if (!menuItem) continue;

        const firstItemInGroup = (item.groupName !== currentGroupName);
        currentGroupName = item.groupName;
        const fakeGroup: MenuItemGroup = {
            name: currentGroupName,
            className: item.groupCssClass,
            items: [],
        };

        if (firstItemInGroup) {
            if (menuItems.length) {
                // add a divider because we know other items are already there.
                menuItems.push({
                    group: fakeGroup,
                    item: {
                        type: "divider",
                    }
                });
            }
            // add the group heading
            if (!IsNullOrWhitespace(currentGroupName)) {
                menuItems.push({
                    group: fakeGroup,
                    item: {
                        type: "sectionHeader",
                        sectionName: currentGroupName,
                    }
                });
            }
        }
        menuItems.push({
            group: fakeGroup,
            item: menuItem,
        });
    }

    return menuItems;
}

const Dashboard3 = ({ navRealm, basePermission, children }: React.PropsWithChildren<{ navRealm?: NavRealm; basePermission?: Permission; }>) => {
    const dashboardContext = React.useContext(DashboardContext);

    if (basePermission && !dashboardContext.isAuthorized(basePermission)) {
        throw new Error(`unauthorized`);
    }

    const theme = useTheme();
    const isMdUp = useMediaQuery(theme.breakpoints.up("md"));

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
    const menuItems: { group: MenuItemGroup, item: MenuItemSpec }[] = [
        ...FlattenMenuGroups(dashboardContext, gMenuItemGroup1),
        ...FlattenDynMenuItems(dashboardContext, dashboardContext.dynMenuLinks.items),
        ...FlattenMenuGroups(dashboardContext, gMenuItemGroup2),
    ];

    return (<>
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
            {
                dashboardContext.isShowingAdminControls &&
                <KeyValueDisplay className="serverStartInfo" data={{ ...dashboardContext.serverStartupState, uptime: formatMillisecondsToDHMS(dashboardContext.serverStartupState.uptimeMS), uptimeMS: undefined }} />
            }
        </Box>
    </>
    );
}


const Dashboard2 = ({ navRealm, basePermission, children }: React.PropsWithChildren<{ navRealm?: NavRealm; basePermission?: Permission }>) => {
    React.useEffect(() => {
        document.documentElement.style.setProperty('--drawer-paper-width', drawerWidth + "px");
    }, []);

    const theme = useTheme();
    const isMdUp = useMediaQuery(theme.breakpoints.up("md"));

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box sx={{ display: "flex" }} className={`CMDashboard2 ${isMdUp ? "bigScreen" : "smallScreen"} NODE_ENV_${process.env.NODE_ENV}`}>
                <DashboardContextProvider>
                    <Dashboard3 navRealm={navRealm} basePermission={basePermission}>
                        {children}
                    </Dashboard3>
                </DashboardContextProvider>
            </Box>
        </LocalizationProvider>
    );
}


export default Dashboard2;
