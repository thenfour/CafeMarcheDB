import { useSession } from "@blitzjs/auth";
import { Routes } from "@blitzjs/next";
import { useMutation } from "@blitzjs/rpc";
import MenuIcon from '@mui/icons-material/Menu';
import MoreIcon from '@mui/icons-material/MoreVert';
import { AppBar, Avatar, Box, Divider, IconButton, ListItemIcon, Menu, MenuItem, Toolbar, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from "@mui/material/styles";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import Link from "next/link";
import { useRouter } from "next/router";
import * as React from 'react';
import { Permission } from "shared/permissions";
import { slugify } from "shared/rootroot";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import stopImpersonating from "src/auth/mutations/stopImpersonating";
import { API } from "../../db3/clientAPI";
import { getAbsoluteUrl } from "../../db3/clientAPILL";
import { gIconMap } from "../../db3/components/IconMap";
import { GetICalRelativeURIForUserUpcomingEvents } from "../../db3/shared/apiTypes";
import { AppContextMarker } from "../AppContext";
import { AdminInspectObject } from "../CMCoreComponents2";
import { ConfirmProvider } from "../ConfirmationDialog";
import { DashboardContext, DashboardContextProvider, useFeatureRecorder } from "../DashboardContext";
import { ActivityFeature } from "../featureReports/activityTracking";
import { LoginSignup } from "../LoginSignupForm";
import {
    NavRealm,
    SideMenu
} from "../MenuStructure";
import { MessageBoxProvider } from "../MessageBoxContext";
import { MetronomeDialogButton } from "../Metronome";
import { MainSiteSearch } from "../search/MainSiteSearch";
import { SnackbarContext } from "../SnackbarContext";
import { MediaPlayerProvider, useMediaPlayer } from "../mediaPlayer/MediaPlayerContext";
import { MediaPlayerBar } from "../mediaPlayer/MediaPlayerBar";

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
    );
}; // PrimarySearchAppBar

const Dashboard3 = ({ navRealm, basePermission, children }: React.PropsWithChildren<{ navRealm?: NavRealm; basePermission?: Permission; }>) => {
    const dashboardContext = React.useContext(DashboardContext);
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
    const gridStyles = {
        display: 'grid',
        height: '100vh',
        width: '100%',
        gridTemplateRows: 'auto 1fr auto', // AppBar, Content, MediaBar (footer)
        gridTemplateColumns: isMdUp ? `${drawerWidth}px 1fr` : '1fr', // Sidebar, Main (desktop only)
        gridTemplateAreas: isMdUp
            ? `"appbar appbar"
               "sidebar content"
               "mediabar mediabar"`
            : `"appbar"
               "content"
               "mediabar"`,
        gap: 0,
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
                className="mediaPlayerBarContainer"
                sx={{
                    gridArea: 'mediabar',
                    zIndex: 9999, // Must be usable even when dialogs are open
                    '& .mediaPlayerBar': {
                        position: 'relative',
                        left: 'auto',
                        right: 'auto',
                        bottom: 'auto',
                        pointerEvents: 'auto',
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
        <LocalizationProvider dateAdapter={AdapterDayjs}>
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
        </LocalizationProvider>
    );
}


export default Dashboard2;
