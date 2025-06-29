//  https://codesandbox.io/s/material-ui-responsive-drawer-skqdw?resolutionWidth=1292&resolutionHeight=758&file=/src/App.js
// https://mui.com/material-ui/react-app-bar/#app-bar-with-a-primary-search-field
import { useSession } from "@blitzjs/auth";
import { Routes } from "@blitzjs/next";
import { useMutation } from "@blitzjs/rpc";
import {
    AudioFileOutlined,
    CalendarMonthOutlined as CalendarMonthOutlinedIcon,
    MusicNote as MusicNoteIcon,
    MusicNoteOutlined as MusicNoteOutlinedIcon,
    Settings as SettingsIcon
} from '@mui/icons-material';
import CollectionsIcon from '@mui/icons-material/Collections';
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
import { getAbsoluteUrl } from "../db3/clientAPILL";
import { gIconMap } from "../db3/components/IconMap";
import { GetICalRelativeURIForUserUpcomingEvents } from "../db3/shared/apiTypes";
import { AppContextMarker } from "./AppContext";
import { ConfirmProvider } from "./ConfirmationDialog";
import { DashboardContext, DashboardContextData, DashboardContextProvider, useClientTelemetryEvent, useFeatureRecorder } from "./DashboardContext";
import { LoginSignup } from "./LoginSignupForm";
import { MainSiteSearch } from "./MainSiteSearch";
import { MetronomeDialogButton } from "./Metronome";
import { SnackbarContext } from "./SnackbarContext";
import { MessageBoxProvider } from "./context/MessageBoxContext";
import { ActivityFeature } from "./featureReports/activityTracking";
import { AdminInspectObject } from "./CMCoreComponents2";

const drawerWidth = 260;


const AppBarUserIcon_MenuItems = ({ closeMenu }: { closeMenu: () => void }) => {
    //const [logoutMutation] = useMutation(logout);
    const router = useRouter();
    //const [currentUser] = useCurrentUser();
    const sess = useSession();
    const showAdminControlsMutation = API.other.setShowingAdminControlsMutation.useToken();
    const isShowingAdminControls = !!sess.showAdminControls;
    const [currentUser] = useCurrentUser();
    const recordFeature = useFeatureRecorder();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const [stopImpersonatingMutation] = useMutation(stopImpersonating);

    const onClickStopImpersonating = async () => {
        closeMenu();
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
                <MenuItem onClick={async () => {
                    await onClickShowAdminControls(false);
                    closeMenu();
                }}
                >
                    <ListItemIcon>{gIconMap.Settings()}</ListItemIcon>
                    Hide admin config
                </MenuItem>
                : <MenuItem onClick={async () => {
                    await onClickShowAdminControls(true);
                    closeMenu();
                }}
                >
                    <ListItemIcon>{gIconMap.Settings()}</ListItemIcon>
                    Show admin config
                </MenuItem>
            }

            <Divider />
        </>
        }

        {currentUser &&
            <>
                <MenuItem component={Link} href={`/backstage/wiki/${slugify("calendar-sync-help")}`} target="_blank" rel="noreferrer" onClick={closeMenu}>
                    <ListItemIcon>{gIconMap.Help()}</ListItemIcon>
                    How to use calendar sync...
                </MenuItem>
                <MenuItem onClick={async () => {
                    const uri = getAbsoluteUrl(GetICalRelativeURIForUserUpcomingEvents({ userAccessToken: currentUser.accessToken }));
                    await navigator.clipboard.writeText(uri);
                    closeMenu();
                    showSnackbar({ children: "Link address copied", severity: 'success' });
                }}>
                    <ListItemIcon>{gIconMap.ContentCopy()}</ListItemIcon>
                    Copy Calendar Link Address
                </MenuItem>
                <MenuItem component={Link} href={GetICalRelativeURIForUserUpcomingEvents({ userAccessToken: currentUser.accessToken })} target="_blank" rel="noreferrer" onClick={closeMenu}>
                    <ListItemIcon>{gIconMap.CalendarMonth()}</ListItemIcon>
                    Calendar feed (iCal format)
                </MenuItem>
                <Divider />
            </>
        }

        <MenuItem component={Link} href='/backstage/profile' onClick={closeMenu}>Your profile</MenuItem>
        <Divider />

        <MenuItem onClick={async () => {
            // just doing the mutation here will keep a bunch of app state; better to cleanly navigate to a simple logout page where we don't risk access exceptions.
            void recordFeature({
                feature: ActivityFeature.logout,
                context: "AppBarAvatarMenu",
            });
            closeMenu();
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
                <AppBarUserIcon_MenuItems closeMenu={() => setAnchorEl(null)} />
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
                <AppBarUserIcon_MenuItems closeMenu={() => setAnchorEl(null)} />
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
                        <Link href={"/backstage"} className={`logo`}>Café Marché Backstage</Link>
                    </Typography>

                    <MetronomeDialogButton />

                    <MainSiteSearch />

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
    files = "files",
    users = "users",
    wikiPages = "wikiPages",
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
    renderIcon: () => React.ReactNode;
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
    //const recordFeature = useFeatureRecorder();
    const recordFeature = useClientTelemetryEvent();

    if (props.item.item.type === "divider") {
        return <Divider className={`${props.item.group.className} divider`} />;
    }
    if (props.item.item.type === "sectionHeader") {
        return (<ListSubheader component="div" className={`${props.item.group.className} sectionHeader`}>
            <Typography variant="button" noWrap>{props.item.item.sectionName}</Typography>
        </ListSubheader>);
    }
    if (props.item.item.type === "link") {

        // Check if the item is selected based on the current path and realm
        const item = props.item?.item;

        let selected = false;
        if (item?.realm && props.realm) {
            selected = item.realm === props.realm;
        } else if (item?.path) {
            selected = router.pathname === item.path; // safer than asPath
        }

        // Use Next.js Link for internal links, plain <a> for external
        const isExternal = props.item.item.openInNewTab;
        const buttonContent = <>
            {props.item.item.renderIcon && <ListItemIcon>{props.item.item.renderIcon()}</ListItemIcon>}
            <ListItemText primary={props.item.item.linkCaption} />
        </>;

        if (isExternal && props.item.item.type === "link") {
            // External link: open in new tab, use <a>
            const linkItem = props.item.item;
            return (
                <ListItemButton
                    component="a"
                    href={linkItem.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`linkMenuItem ${props.item.group.className} ${linkItem.className}`}
                    onClick={e => {
                        // Log activity for external link using beacon
                        void recordFeature({
                            feature: ActivityFeature.link_follow_external,
                        });
                    }}
                >
                    {buttonContent}
                </ListItemButton>
            );
        } else if (props.item.item.type === "link") {
            // Internal link: use Next.js Link for client-side navigation
            const linkItem = props.item.item;
            return (
                <ListItemButton
                    component={Link}
                    href={linkItem.path}
                    selected={selected}
                    className={`linkMenuItem ${props.item.group.className} ${linkItem.className}`}
                    onClick={e => {
                        // Log activity for internal link using beacon
                        void recordFeature({
                            feature: ActivityFeature.link_follow_internal,
                        });
                    }}
                >
                    {buttonContent}
                </ListItemButton>
            );
        }
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
            { type: "link", path: "/backstage/wikiPages", realm: NavRealm.wikiPages, linkCaption: "Wiki pages", renderIcon: () => gIconMap.Article(), permission: Permission.view_wiki_pages },
            { type: "link", path: "/backstage/files", realm: NavRealm.files, linkCaption: "Files", renderIcon: () => gIconMap.AttachFile(), permission: Permission.access_file_landing_page },
            { type: "link", path: "/backstage/setlistPlanner", linkCaption: "Setlist Planner", renderIcon: () => <AudioFileOutlined />, permission: Permission.setlist_planner_access },
            // { type: "link", path: "/backstage/info", linkCaption: "Info", renderIcon: () => <InfoIcon />, permission: Permission.visibility_members },
            { type: "link", path: "/backstage/stats", linkCaption: "Stats", renderIcon: gIconMap.Equalizer, permission: Permission.view_events_nonpublic },
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
            { type: "link", path: "/backstage/workflows", linkCaption: "Workflows", renderIcon: gIconMap.AccountTree, permission: Permission.view_workflow_defs },
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
            { type: "link", path: "/backstage/featureReports", linkCaption: "Feature Usage", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/adminLogs", linkCaption: "Logs", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/serverHealth", linkCaption: "Server health", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/calendarPreview", linkCaption: "iCal Preview", renderIcon: () => gIconMap.CalendarMonth(), permission: Permission.sysadmin },
            { type: "link", path: "/backstage/users", realm: NavRealm.users, linkCaption: "Users (search)", renderIcon: gIconMap.Search, permission: Permission.admin_users },
            { type: "link", path: "/backstage/adminUsers", linkCaption: "Users (adm)", renderIcon: () => <PersonIcon />, permission: Permission.admin_users },
            { type: "link", path: "/backstage/editUserTags", linkCaption: "Tags", renderIcon: () => gIconMap.Tag(), permission: Permission.admin_users },
            { type: "link", path: "/backstage/roles", linkCaption: "Roles", renderIcon: () => <SecurityIcon />, permission: Permission.admin_users },
            { type: "link", path: "/backstage/permissions", linkCaption: "Permissions", renderIcon: () => <SecurityIcon />, permission: Permission.admin_users },
            { type: "link", path: "/backstage/rolePermissions", linkCaption: "Permission matrix", renderIcon: () => <SecurityIcon />, permission: Permission.admin_users },
        ],
    },
    {
        name: "Admin-Temporary",
        className: "admin temporary",
        items: [
            { type: "link", path: "/backstage/eventImport", linkCaption: "Import events", renderIcon: gIconMap.CalendarMonth, permission: Permission.admin_events },
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
            { type: "link", path: "/backstage/editEventTypes", linkCaption: "Event Types", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/editEventStatuses", linkCaption: "Event Statuses", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/editEventTags", linkCaption: "Event Tags", renderIcon: () => gIconMap.Tag(), permission: Permission.sysadmin },
            { type: "link", path: "/backstage/editEventAttendances", linkCaption: "Attendance Options", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/editEventCustomFields", linkCaption: "CustomFields", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },

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
        name: "Admin Wiki",
        className: "admin wiki",
        items: [
            { type: "link", path: "/backstage/editWikiPageTags", linkCaption: "Wiki Page Tags", renderIcon: () => gIconMap.Tag(), permission: Permission.sysadmin },
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
        if (!dashboardContext.isAuthorizedForVisibility(item.visiblePermissionId, item.createdByUserId)) continue;
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
    let forceLogin = false;

    if (basePermission && !dashboardContext.isAuthorized(basePermission)) {
        // are you even logged in?
        if (!dashboardContext.session?.userId) {
            // just redirect to login.
            forceLogin = true;
        } else {
            throw new Error(`unauthorized`);
        }
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

    const getMenuItemName = (item: MenuItemSpec): string => {
        if (item.type === "link") {
            return item.linkCaption;
        }
        if (item.type === "sectionHeader") {
            return item.sectionName;
        }
        return "??";
    };

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
            <AppContextMarker name="dashboardMenu">
                <List component="nav" className="CMMenu">
                    {
                        menuItems.map((item, index) => <AppContextMarker name={getMenuItemName(item.item)} key={index}>
                            <MenuItemComponent key={index} item={item} realm={navRealm} />
                        </AppContextMarker>)
                    }
                    <li style={{ height: 100 }}></li>{/* gives space at the bottom of the nav, which helps make things accessible if the bottom of the window is covered (e.g. snackbar message or error message is visible) */}
                </List>
            </AppContextMarker>
        </Drawer>
        <Box sx={{
            flexGrow: 1,
            backgroundColor: theme.palette.background.default,
            padding: theme.spacing(3)
        }}
            className="mainContentBackdrop"
        >
            <Toolbar />
            <AdminInspectObject label="DashboardCtx" src={dashboardContext} />

            <React.Suspense>
                {forceLogin ? <LoginSignup /> : children}
            </React.Suspense>
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
                    <AppContextMarker name="bs">
                        <ConfirmProvider>
                            <MessageBoxProvider>
                                <Dashboard3 navRealm={navRealm} basePermission={basePermission}>
                                    {children}
                                </Dashboard3>
                            </MessageBoxProvider>
                        </ConfirmProvider>
                    </AppContextMarker>
                </DashboardContextProvider>
            </Box>
        </LocalizationProvider>
    );
}


export default Dashboard2;
