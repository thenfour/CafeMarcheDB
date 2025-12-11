import { Setting } from "@/shared/settingKeys";
import { IsNullOrWhitespace } from "@/shared/utils";
import { useSession } from "@blitzjs/auth";
import { Routes } from "@blitzjs/next";
import { useMutation } from "@blitzjs/rpc";
import { QrCode } from "@mui/icons-material";
import MenuIcon from '@mui/icons-material/Menu';
import MoreIcon from '@mui/icons-material/MoreVert';
import { AppBar, Avatar, Box, Divider, IconButton, ListItemIcon, Menu, MenuItem, Toolbar, Tooltip, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from "@mui/material/styles";
import Link from "next/link";
import { useRouter } from "next/router";
import * as React from 'react';
import { Permission } from "shared/permissions";
import { slugify } from "shared/rootroot";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import stopImpersonating from "src/auth/mutations/stopImpersonating";
import { useBrand } from "../../../../shared/brandConfig";
import { API } from "../../db3/clientAPI";
import { gIconMap } from "../../db3/components/IconMap";
import { GetICalRelativeURIForUserUpcomingEvents } from "../../db3/shared/apiTypes";
import { QrHelpers } from "../../db3/shared/qrApi";
import { AppContextMarker } from "../AppContext";
import { AdminInspectObject } from "../CMCoreComponents2";
import { ConfirmProvider } from "../ConfirmationDialog";
import { DashboardContextProvider, useDashboardContext, useFeatureRecorder } from "../dashboardContext/DashboardContext";
import { ActivityFeature } from "../featureReports/activityTracking";
import { LoginSignup } from "../LoginSignupForm";
import { MediaPlayerBar } from "../mediaPlayer/MediaPlayerBar";
import { MediaPlayerProvider, useMediaPlayer } from "../mediaPlayer/MediaPlayerContext";
import { MessageBoxProvider } from "../MessageBoxContext";
import { MetronomeDialogButton } from "../Metronome";
import { QrCodeButton } from "../QrCode";
import { MainSiteSearch } from "../search/MainSiteSearch";
import { SettingMarkdown } from "../SettingMarkdown";
import { useSnackbar } from "../SnackbarContext";
import {
    SideMenu
} from "./MenuStructure";
import { NavRealm } from "./StaticMenuItems";
import { ServerStartInfo } from "@/shared/serverStateBase";

const drawerWidth = 260;

const formatVersionLabel = (versionInfo?: ServerStartInfo): string => {
    if (!versionInfo) return "";
    const tagLabel = versionInfo.versionTag || versionInfo.gitRevision || "-";
    const commitCount = Number.isFinite(versionInfo.versionCommitsSinceTag)
        ? versionInfo.versionCommitsSinceTag
        : 0;
    const commitSuffix = commitCount > 0 ? `+${commitCount}` : "";
    const dirtySuffix = versionInfo.versionIsDirty ? " (modified)" : "";
    return `${tagLabel}${commitSuffix}${dirtySuffix}`;
};


const AppBarUserIcon_MenuItems = ({ closeMenu }: { closeMenu: () => void }) => {
    //const [logoutMutation] = useMutation(logout);
    const router = useRouter();
    //const [currentUser] = useCurrentUser();
    const sess = useSession();
    const showAdminControlsMutation = API.other.setShowingAdminControlsMutation.useToken();
    const isShowingAdminControls = !!sess.showAdminControls;
    const dashboardContext = useDashboardContext();
    const currentUser = dashboardContext.currentUser;
    const recordFeature = useFeatureRecorder();
    const { showMessage: showSnackbar } = useSnackbar();

    const [stopImpersonatingMutation] = useMutation(stopImpersonating);

    const onClickStopImpersonating = async () => {
        closeMenu();
        await stopImpersonatingMutation();
    };

    const onClickShowAdminControls = async (showAdminControls: boolean) => {
        await showAdminControlsMutation.invoke({ showAdminControls });
    };

    const versionLabel = React.useMemo(() => formatVersionLabel(dashboardContext.serverStartupState), [dashboardContext.serverStartupState]);

    return <>
        {(sess.impersonatingFromUserId != null) && (
            <MenuItem onClick={onClickStopImpersonating}>Stop impersonating</MenuItem>
        )}

        {(!!sess.isSysAdmin) && <>

            {versionLabel && (
                <MenuItem component={Link} href='/backstage/serverHealth' onClick={closeMenu}>
                    <ListItemIcon>{gIconMap.Info()}</ListItemIcon>
                    Version: {versionLabel}
                </MenuItem>
            )}

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
                    const uri = dashboardContext.getAbsoluteUri(GetICalRelativeURIForUserUpcomingEvents({ userAccessToken: currentUser.accessToken }));
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
    const dashboardContext = useDashboardContext();
    //const showAdminControlsMutation = API.other.setShowingAdminControlsMutation.useToken();

    const session = useSession();
    //let backgroundColor: string | undefined = undefined;
    // if (session.impersonatingFromUserId != null) {
    //     backgroundColor = "#844";
    // }

    const brand = useBrand();
    const versionLabel = React.useMemo(() => formatVersionLabel(dashboardContext.serverStartupState), [dashboardContext.serverStartupState]);
    return (
        <AppBar
            position="static"
            sx={{
                gridArea: 'appbar',
                zIndex: theme.zIndex.drawer + 1
            }}
        >
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
                <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1 }}>
                    {brand.siteLogoUrl && (
                        <Link href={"/backstage"} aria-label="Home" style={{ display: 'inline-flex' }}>
                            <img src={brand.siteLogoUrl} alt="logo" style={{ display: 'block' }} />
                        </Link>
                    )}
                    <Typography
                        variant="h6"
                        noWrap
                        component="div"
                    >
                        {!IsNullOrWhitespace(brand.siteTitle) && <Link href={"/backstage"} className={`logo`}>{brand.siteTitle}</Link>}
                    </Typography>
                </Box>

                <MetronomeDialogButton />

                <Tooltip title="Show QR code for this page">
                    <div>
                        <AppContextMarker name="appBarQrCode">
                            <QrCodeButton
                                content={QrHelpers.url(dashboardContext.getAbsoluteUri(router.asPath))}
                                title="QR code for this page"
                                description={<SettingMarkdown setting={Setting.QrCodeForThisPageDescriptionMarkdown} />}
                                renderButton={({ onClick }) => (
                                    <div
                                        className="freeButton globalMetronomeButton"
                                        onClick={() => onClick()}
                                    >
                                        <QrCode />
                                    </div>
                                )}
                            />
                        </AppContextMarker>
                    </div>
                </Tooltip>

                <MainSiteSearch />

                <Box sx={{ flexGrow: 1 }} />{/* spacing to separate left from right sides */}

                {session.isSysAdmin && versionLabel && (
                    <Typography variant="body2" sx={{ mr: 2, display: { xs: 'none', sm: 'inline-flex' }, alignItems: 'center' }}>
                        {versionLabel}
                    </Typography>
                )}

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
    );
}; // PrimarySearchAppBar

const Dashboard3 = ({ navRealm, basePermission, children }: React.PropsWithChildren<{ navRealm?: NavRealm; basePermission?: Permission; }>) => {
    const dashboardContext = useDashboardContext();
    const mediaPlayer = useMediaPlayer();
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

    // Grid layout configuration
    const isMediaBarVisible = !!(mediaPlayer.currentTrack || mediaPlayer.playlist.length > 0);
    const gridStyles = {
        display: 'grid',
        height: '100vh',
        width: '100%',
        gridTemplateRows: isMediaBarVisible ? 'auto 1fr auto' : 'auto 1fr 0fr', // AppBar, Content, MediaBar (footer)
        gridTemplateColumns: isMdUp ? `${drawerWidth}px 1fr` : '1fr', // Sidebar, Main (desktop only)
        gridTemplateAreas: isMdUp
            ? `"appbar appbar"
               "sidebar content"
               "mediabar mediabar"`
            : `"appbar"
               "content"
               "mediabar"`,
        gap: 0,
        transition: 'grid-template-rows 0.25s cubic-bezier(.4, 0, .2, 1)',
    };

    return (
        <Box sx={gridStyles}>
            {/* AppBar */}
            <PrimarySearchAppBar onClickToggleDrawer={toggleDrawer} />

            {/* Sidebar */}
            <SideMenu
                navRealm={navRealm}
                open={open}
                onClose={() => setOpen(false)}
                variant={isMdUp ? "permanent" : "temporary"}
                drawerWidth={drawerWidth}
                theme={theme}
            />

            {/* Main Content */}
            <Box
                sx={{
                    gridArea: 'content',
                    overflow: 'auto',
                    backgroundColor: theme.palette.background.default,
                    padding: theme.spacing(3)
                }}
                className="mainContentBackdrop"
                id="scrollableDiv"
            >
                <AdminInspectObject label="DashboardCtx" src={dashboardContext} />

                <React.Suspense>
                    {forceLogin ? <LoginSignup /> : <>
                        {children}
                    </>}
                </React.Suspense>
            </Box>

            {/* Media Player Footer */}
            <Box
                ref={(el: HTMLDivElement | null) => {
                    // Measure media bar height for dialog positioning
                    if (el) {
                        const height = el.getBoundingClientRect().height;
                        document.documentElement.style.setProperty('--media-bar-height', `${height}px`);
                    }
                }}
                className={`mediaPlayerBarContainer${isMediaBarVisible
                    ? ' mediaPlayerBarContainer--visible'
                    : ''
                    }`}
                sx={{
                    gridArea: 'mediabar',
                    zIndex: 9999, // Must be usable even when dialogs are open
                    '& .mediaPlayerBar': {
                        position: 'relative !important',
                        left: 'auto !important',
                        right: 'auto !important',
                        bottom: 'auto !important',
                        pointerEvents: 'auto !important',
                    }
                }}
            >
                <MediaPlayerBar mediaPlayer={mediaPlayer} />
            </Box>
        </Box>
    );
}


const Dashboard2 = ({ navRealm, basePermission, children }: React.PropsWithChildren<{ navRealm?: NavRealm; basePermission?: Permission }>) => {
    React.useEffect(() => {
        document.documentElement.style.setProperty('--drawer-paper-width', drawerWidth + "px");
    }, []);

    const theme = useTheme();
    const isMdUp = useMediaQuery(theme.breakpoints.up("md"));

    return (
        <Box className={`CMDashboard2 ${isMdUp ? "bigScreen" : "smallScreen"} NODE_ENV_${process.env.NODE_ENV}`}>
            <DashboardContextProvider>
                <AppContextMarker name="bs">
                    <ConfirmProvider>
                        <MessageBoxProvider>
                            <MediaPlayerProvider>
                                <Dashboard3 navRealm={navRealm} basePermission={basePermission}>
                                    {children}
                                </Dashboard3>
                            </MediaPlayerProvider>
                        </MessageBoxProvider>
                    </ConfirmProvider>
                </AppContextMarker>
            </DashboardContextProvider>
        </Box>
    );
}


export default Dashboard2;
