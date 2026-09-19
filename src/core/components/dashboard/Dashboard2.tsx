import { Setting } from "@/shared/settingKeys";
import { shouldShowAdminControls } from "@/shared/adminControls";
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
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import stopImpersonating from "src/auth/mutations/stopImpersonating";
import { useBrand } from "../../../../shared/brandConfig";
import { API } from "../../db3/clientAPI";
import { gIconMap } from "../../db3/components/IconMap";
import { QrHelpers } from "../../db3/shared/qrApi";
import { AppContextMarker } from "../AppContext";
import { useDialogAfterMenuClose } from "../CMDialog";
import { AdminInspectObject } from "../CMCoreComponents2";
import { ConfirmProvider } from "../ConfirmationDialog";
import { DashboardContextProvider, useDashboardContext, useFeatureRecorder } from "../dashboardContext/DashboardContext";
import { ActivityFeature } from "../featureReports/activityTracking";
import { LoginSignup } from "../LoginSignupForm";
import { MediaPlayerBar } from "../mediaPlayer/MediaPlayerBar";
import { MediaPlayerProvider, useMediaPlayer } from "../mediaPlayer/MediaPlayerContext";
import { MessageBoxProvider } from "../MessageBoxContext";
import { QrCodeDialog } from "../QrCode";
import { MainSiteSearch } from "../search/MainSiteSearch";
import { SettingMarkdown } from "../SettingMarkdown";
import {
    SideMenu
} from "./MenuStructure";
import { NavRealm } from "./StaticMenuItems";
import { ServerStartInfo } from "@/shared/serverStateBase";
import { DateValue } from "../DateTime/DateTimeComponents";
import { findBackstageRouteByPattern } from "@/src/auth/shared/backstageRoutes";
import { ApplicationFrameProvider, useApplicationFrame, useApplicationFrameBackgroundRef } from "./ApplicationFrameContext";
import { useDialogViewportRect } from "../ResponsiveDialog";
import { ConnectionStatusIndicator } from "../../connectivity/ConnectionHealthComponents";

const drawerWidth = 260;

const formatVersionLabel = (versionInfo?: ServerStartInfo | null): string => {
    if (!versionInfo) return "";
    const tagLabel = versionInfo.versionTag;
    const commitCount = versionInfo.versionCommitsSinceTag;
    const commitSuffix = commitCount > 0 ? `+${commitCount}` : "";
    const isUnderDevelopment = commitCount > 0 || versionInfo.versionIsDirty;
    const devIndicator = isUnderDevelopment ? "🚧" : "";
    return `${devIndicator}${tagLabel}${commitSuffix}`;
};


const AppBarUserIcon_MenuItems = ({ closeMenu, showQrCode }: { closeMenu: () => void, showQrCode: () => void }) => {
    //const [logoutMutation] = useMutation(logout);
    const router = useRouter();
    //const [currentUser] = useCurrentUser();
    const sess = useSession();
    const showAdminControlsMutation = API.other.setShowingAdminControlsMutation.useToken();
    const isShowingAdminControls = shouldShowAdminControls(sess);
    const dashboardContext = useDashboardContext();
    const currentUser = dashboardContext.currentUser;
    const recordFeature = useFeatureRecorder();
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

        {dashboardContext.isAuthorized(Permission.sysadmin) && <>

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
                {dashboardContext.isAuthorized(Permission.view_events_nonpublic) && <MenuItem component={Link} href="/backstage/calendar" onClick={closeMenu}>
                    <ListItemIcon>{gIconMap.CalendarMonth()}</ListItemIcon>
                    Calendar subscription
                </MenuItem>
                }
                <AppContextMarker name="appBarQrCode">
                    <MenuItem onClick={() => {
                        void recordFeature({
                            feature: ActivityFeature.qr_code_generate,
                            context: "appBarQrCode/QrCodeButton",
                        });
                        showQrCode();
                    }}>
                        <ListItemIcon><QrCode /></ListItemIcon>
                        Show QR code for this page
                    </MenuItem>
                </AppContextMarker>
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

const AppBarPageQrDialog = ({ open, onClose }: { open: boolean, onClose: () => void }) => {
    const router = useRouter();
    const dashboardContext = useDashboardContext();

    return <AppContextMarker name="appBarQrCodeDialog">
        <QrCodeDialog
            open={open}
            onClose={onClose}
            content={QrHelpers.url(dashboardContext.getAbsoluteUri(router.asPath))}
            title="QR code for this page"
            description={<SettingMarkdown setting={Setting.QrCodeForThisPageDescriptionMarkdown} />}
        />
    </AppContextMarker>;
};

const AppBarUserIcon_Desktop = () => {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const [currentUser] = useCurrentUser();
    const qrDialog = useDialogAfterMenuClose();

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
                open={Boolean(anchorEl)}
                onClose={() => {
                    setAnchorEl(null)
                }}
                TransitionProps={{ onExited: qrDialog.onMenuExited }}
            >
                <AppBarUserIcon_MenuItems
                    closeMenu={() => setAnchorEl(null)}
                    showQrCode={() => qrDialog.requestOpen(() => setAnchorEl(null))}
                />
            </Menu>
            <AppBarPageQrDialog open={qrDialog.dialogOpen} onClose={qrDialog.closeDialog} />
        </Box>
    );
};

const AppBarUserIcon_Mobile = () => {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const qrDialog = useDialogAfterMenuClose();

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
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
                TransitionProps={{ onExited: qrDialog.onMenuExited }}
            >
                <AppBarUserIcon_MenuItems
                    closeMenu={() => setAnchorEl(null)}
                    showQrCode={() => qrDialog.requestOpen(() => setAnchorEl(null))}
                />
            </Menu>
            <AppBarPageQrDialog open={qrDialog.dialogOpen} onClose={qrDialog.closeDialog} />
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

                <Tooltip title="Practice tools">
                    <Link href="/backstage/practice-tools" aria-label="Practice tools" className="freeButton globalMetronomeButton">
                        {gIconMap.VolumeDown()}
                    </Link>
                </Tooltip>

                <MainSiteSearch />

                <Box sx={{ flexGrow: 1 }} />{/* spacing to separate left from right sides */}

                {dashboardContext.isAuthorized(Permission.sysadmin) && versionLabel && dashboardContext.serverStartupState && (
                    <Tooltip title={<>
                        <Typography variant="subtitle1">Server version</Typography>
                        {/* display version details breakdown and explanation */}
                        <Box sx={{ mt: 1 }}>
                            <Typography variant="body2">Tag: {dashboardContext.serverStartupState.versionTag}</Typography>
                            {dashboardContext.serverStartupState.versionCommitsSinceTag > 0 && (
                                <Typography variant="body2">Commits since tag: {dashboardContext.serverStartupState.versionCommitsSinceTag}</Typography>)
                            }
                            {dashboardContext.serverStartupState.versionIsDirty && (
                                <Typography variant="body2">With local modifications</Typography>
                            )}
                            <Typography variant="body2">Git commit date: <DateValue value={dashboardContext.serverStartupState.gitCommitDate} /></Typography>
                        </Box>

                    </>}>
                        <Typography variant="body2" sx={{ mr: 2, display: { xs: 'none', sm: 'inline-flex' }, alignItems: 'center', cursor: 'pointer' }}>
                            <a href="/backstage/serverHealth" style={{ color: 'inherit', textDecoration: 'none' }}>
                                {versionLabel}
                            </a>
                        </Typography>
                    </Tooltip>
                )}

                {(session.userId != null) && <>
                    <ConnectionStatusIndicator />
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

const Dashboard3 = ({ navRealm, children }: React.PropsWithChildren<{ navRealm?: NavRealm; }>) => {
    const dashboardContext = useDashboardContext();
    const applicationFrame = useApplicationFrame();
    const router = useRouter();
    const mediaPlayer = useMediaPlayer();
    let forceLogin = false;

    const registeredRoute = findBackstageRouteByPattern(router.pathname);
    if (!registeredRoute) {
        throw new Error(`No route for path: ${router.pathname}`);
    }
    const isPageAuthorized = dashboardContext.isAuthorized(registeredRoute.permission);
    if (!isPageAuthorized) {
        // are you even logged in?
        if (!dashboardContext.session?.userId) {
            // just redirect to login.
            forceLogin = true;
        } else {
            console.log(`unauthorized access to route`, registeredRoute);
            throw new Error(`unauthorized`);
        }
    }

    const theme = useTheme();
    const isMdUp = useMediaQuery(theme.breakpoints.up("md"));

    const [open, setOpen] = React.useState(false);
    const applicationBackgroundRef = useApplicationFrameBackgroundRef();

    if (!applicationFrame) throw new Error("Dashboard3 must be rendered inside ApplicationFrameProvider");

    const toggleDrawer = event => {
        if (
            event.type === "keydown" &&
            (event.key === "Tab" || event.key === "Shift")
        ) {
            return;
        }

        setOpen(!open);
    };

    React.useEffect(() => {
        if (applicationFrame.hasOpenDialogs) setOpen(false);
    }, [applicationFrame.hasOpenDialogs]);

    // The player is a peer of the main application region. Dialogs are
    // portaled into the application region and therefore cannot cover or
    // consume the player's space.
    const isMediaBarVisible = !!(mediaPlayer.currentTrack || mediaPlayer.playlist.length > 0);
    const applicationViewport = useDialogViewportRect(true);
    const viewportRootStyles = {
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
    };
    const frameStyles = {
        display: 'grid',
        position: 'absolute',
        top: applicationViewport?.top ?? 0,
        left: applicationViewport?.left ?? 0,
        height: applicationViewport?.height ?? '100dvh',
        width: applicationViewport?.width ?? '100vw',
        minWidth: 0,
        minHeight: 0,
        gridTemplateRows: isMediaBarVisible ? 'minmax(0, 1fr) auto' : 'minmax(0, 1fr) 0fr',
        gridTemplateAreas: '"application" "mediabar"',
        gap: 0,
        transition: 'grid-template-rows 0.25s cubic-bezier(.4, 0, .2, 1)',
    };
    const applicationGridStyles = {
        display: 'grid',
        height: '100%',
        width: '100%',
        minWidth: 0,
        minHeight: 0,
        gridTemplateRows: 'auto minmax(0, 1fr)',
        gridTemplateColumns: isMdUp ? `${drawerWidth}px 1fr` : '1fr', // Sidebar, Main (desktop only)
        gridTemplateAreas: isMdUp
            ? `"appbar appbar"
               "sidebar content"`
            : `"appbar"
               "content"`,
        gap: 0,
    };

    return (
        <Box sx={viewportRootStyles} className="ApplicationFrameViewportRoot">
            <Box sx={frameStyles} className="ApplicationFrame">
                <Box
                    sx={{ gridArea: 'application', position: 'relative', minWidth: 0, minHeight: 0 }}
                    className="ApplicationFrameMainRegion"
                >
                    <Box
                        ref={applicationBackgroundRef}
                        sx={applicationGridStyles}
                        className="ApplicationFrameBackground"
                    >
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
                                minWidth: 0,
                                minHeight: 0,
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
                    </Box>

                    <Box
                        ref={applicationFrame.dialogHostRef}
                        className="ApplicationFrameDialogHost"
                        data-application-dialog-host
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            overflow: 'hidden',
                            pointerEvents: 'none',
                            zIndex: theme.zIndex.modal,
                        }}
                    />
                </Box>

                {/* Media Player Footer */}
                <Box
                    className={`mediaPlayerBarContainer${isMediaBarVisible
                        ? ' mediaPlayerBarContainer--visible'
                        : ''
                        }`}
                    sx={{
                        gridArea: 'mediabar',
                        minWidth: 0,
                        minHeight: 0,
                    }}
                >
                    <MediaPlayerBar mediaPlayer={mediaPlayer} />
                </Box>
            </Box>
        </Box>
    );
}


const Dashboard2 = ({ navRealm, children }: React.PropsWithChildren<{ navRealm?: NavRealm; }>) => {
    React.useEffect(() => {
        document.documentElement.style.setProperty('--drawer-paper-width', drawerWidth + "px");
    }, []);

    const theme = useTheme();
    const isMdUp = useMediaQuery(theme.breakpoints.up("md"));

    return (
        <Box className={`CMDashboard2 ${isMdUp ? "bigScreen" : "smallScreen"} cmdb_env_${process.env.NODE_ENV}`}>
            <DashboardContextProvider>
                <ApplicationFrameProvider>
                    <AppContextMarker name="bs">
                        <ConfirmProvider>
                            <MessageBoxProvider>
                                <MediaPlayerProvider>
                                    <Dashboard3 navRealm={navRealm}>
                                        {children}
                                    </Dashboard3>
                                </MediaPlayerProvider>
                            </MessageBoxProvider>
                        </ConfirmProvider>
                    </AppContextMarker>
                </ApplicationFrameProvider>
            </DashboardContextProvider>
        </Box>
    );
}


export default Dashboard2;
