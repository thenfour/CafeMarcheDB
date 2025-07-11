import { BlitzPage } from "@blitzjs/next";
import React, { useState, useLayoutEffect, useRef } from "react";
import { AppBar, Toolbar, Typography, IconButton, Box, Drawer, List, ListItem, ListItemText, Paper, useMediaQuery, useTheme, Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import MenuIcon from '@mui/icons-material/Menu';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';

//////////////////////////////////////////////////////////////////////////////////////////////////
const GridTestPage: BlitzPage = (props) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [mediaBarHeight, setMediaBarHeight] = useState(0);
    const mediaBarRef = useRef<HTMLDivElement>(null);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    // Measure media bar height for dialog positioning
    useLayoutEffect(() => {
        if (mediaBarRef.current) {
            const height = mediaBarRef.current.getBoundingClientRect().height;
            setMediaBarHeight(height);
        }
    }, [isPlaying]); // Re-measure if content changes

    const gridStyles = {
        display: 'grid',
        height: '100vh',
        gridTemplateRows: 'auto 1fr auto', // AppBar, Content, MediaBar (footer)
        gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr', // Sidebar, Main (desktop only)
        gridTemplateAreas: isMobile
            ? `"appbar"
               "content"
               "mediabar"`
            : `"appbar appbar"
               "sidebar content"
               "mediabar mediabar"`,
        gap: 0,
    };

    return (
        <Box sx={gridStyles}>
            {/* AppBar */}
            <AppBar
                position="static"
                sx={{
                    gridArea: 'appbar',
                    zIndex: theme.zIndex.drawer + 1
                }}
            >
                <Toolbar>
                    <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        edge="start"
                        sx={{ mr: 2, display: { md: 'none' } }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" noWrap component="div">
                        Dashboard Grid Layout Demo
                    </Typography>
                </Toolbar>
            </AppBar>

            {/* Sidebar */}
            {isMobile ? (
                <Drawer
                    variant="temporary"
                    open={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                    sx={{
                        '& .MuiDrawer-paper': {
                            width: 240,
                            top: 'auto', // Let it position naturally
                        },
                    }}
                >
                    <SidebarContent />
                </Drawer>
            ) : (
                <Paper
                    elevation={1}
                    sx={{
                        gridArea: 'sidebar',
                        width: 240,
                        overflow: 'auto',
                        borderRadius: 0,
                        borderRight: '1px solid #e0e0e0'
                    }}
                >
                    <SidebarContent />
                </Paper>
            )}

            {/* Main Content */}
            <Box
                sx={{
                    gridArea: 'content',
                    p: 3,
                    overflow: 'auto',
                    backgroundColor: '#fafafa'
                }}
            >
                <Typography variant="h4" gutterBottom>
                    Grid Layout Demo
                </Typography>

                <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Key Benefits Demonstrated:
                    </Typography>
                    <ul>
                        <li>✅ <strong>No manual offset calculations</strong> - Grid handles spacing automatically</li>
                        <li>✅ <strong>Responsive behavior</strong> - Sidebar becomes drawer on mobile</li>
                        <li>✅ <strong>Media bar as footer</strong> - Always visible at bottom</li>
                        <li>✅ <strong>Modal compatibility</strong> - Dialogs don't interfere with media bar</li>
                        <li>✅ <strong>Proper z-index management</strong> - No stacking context issues</li>
                        <li>✅ <strong>Semantic layout structure</strong> - Clear grid areas</li>
                    </ul>
                </Paper>

                <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Current Grid Configuration:
                    </Typography>
                    <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace', backgroundColor: '#f5f5f5', p: 2, borderRadius: 1 }}>
                        {`Desktop:
grid-template-areas:
  "appbar  appbar"
  "sidebar content"
  "mediabar mediabar"

Mobile:
grid-template-areas:
  "appbar"
  "content"
  "mediabar"`}
                    </Typography>
                </Paper>

                <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Modal Dialog Test (Media Bar Aware):
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Click the button below to test that MUI modals work correctly with the media bar footer.
                        The dialog automatically adjusts its positioning to avoid overlapping with the media bar.
                    </Typography>
                    <Button
                        variant="contained"
                        onClick={() => setModalOpen(true)}
                        sx={{ mb: 2 }}
                    >
                        Open Modal Dialog
                    </Button>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        <strong>Solution implemented:</strong> Dynamic padding on dialog backdrop and container
                        based on measured media bar height ({mediaBarHeight}px).
                    </Typography>
                </Paper>

                <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Comparison with Current Approach:
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Instead of calculating: <code>marginTop: appBarHeight; marginBottom: mediaBarHeight</code>
                        <br />
                        Grid automatically positions content between AppBar and Media Bar footer.
                    </Typography>
                </Paper>

                {/* Demo content to show scrolling */}
                {Array.from({ length: 20 }, (_, i) => (
                    <Paper key={i} elevation={1} sx={{ p: 2, mb: 2 }}>
                        <Typography variant="body1">
                            Content Block {i + 1} - This demonstrates that the content area scrolls independently
                            without interfering with the fixed AppBar and Media Bar positioning.
                        </Typography>
                    </Paper>
                ))}
            </Box>

            {/* Media Bar (Footer) */}
            <Paper
                ref={mediaBarRef}
                elevation={3}
                sx={{
                    gridArea: 'mediabar',
                    p: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    backgroundColor: '#f5f5f5',
                    borderRadius: 0,
                    borderTop: '1px solid #e0e0e0',
                    zIndex: 9999, // it must be usable even when dialogs are open
                }}
            >
                <IconButton
                    onClick={() => setIsPlaying(!isPlaying)}
                    color="primary"
                >
                    {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                </IconButton>
                <Typography variant="body2" sx={{ flex: 1 }}>
                    {isPlaying ? "🎵 Now Playing: Sample Song" : "🎵 Media Player Ready"}
                </Typography>
                <VolumeUpIcon color="action" />
            </Paper>

            {/* Modal Dialog */}
            <Dialog
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                maxWidth="sm"
                fullWidth
                sx={{
                    '& .MuiBackdrop-root': {
                        // Add padding to backdrop to prevent overlap with media bar
                        paddingBottom: `${mediaBarHeight}px`,
                    },
                    '& .MuiDialog-container': {
                        // Ensure dialog container respects the padding
                        paddingBottom: `${mediaBarHeight}px`,
                        alignItems: 'flex-start', // Align to top instead of center
                        paddingTop: '64px', // Add some top padding for better positioning
                    },
                    '& .MuiDialog-paper': {
                        // Dialog should be above content but below media bar
                        zIndex: theme.zIndex.modal - 1,
                        margin: 'auto',
                        maxHeight: `calc(100vh - ${mediaBarHeight + 64}px)`, // Account for media bar + top padding
                    }
                }}
            >
                <DialogTitle>Modal Dialog Test</DialogTitle>
                <DialogContent>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                        This modal dialog demonstrates that:
                    </Typography>
                    <ul>
                        <li>The media bar footer remains visible and clickable</li>
                        <li>The dialog doesn't overlap with the media bar</li>
                        <li>Proper spacing is maintained automatically</li>
                        <li>The dialog content is fully accessible</li>
                    </ul>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        You should be able to see and interact with the media bar footer at the bottom
                        of the screen even with this dialog open. The dialog automatically adjusts its
                        positioning to avoid overlapping with the media bar.
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        <strong>Current media bar height:</strong> {mediaBarHeight}px
                    </Typography>

                    {/* Add some extra content to test scrolling */}
                    {Array.from({ length: 10 }, (_, i) => (
                        <Typography key={i} variant="body2" sx={{ mt: 1 }}>
                            Extra content line {i + 1} to test dialog scrolling behavior when content
                            is too long to fit in the available space.
                        </Typography>
                    ))}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setModalOpen(false)}>Close</Button>
                    <Button onClick={() => setIsPlaying(!isPlaying)} variant="outlined">
                        Toggle Media Player
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

const SidebarContent = () => (
    <List>
        {['Dashboard', 'Events', 'Songs', 'Users', 'Settings', 'Events', 'Songs', 'Users', 'Settings', 'Events', 'Songs', 'Users', 'Settings', 'Events', 'Songs', 'Users', 'Settings', 'Events', 'Songs', 'Users', 'Settings'].map((text, index) => (
            <ListItem key={text} sx={{ borderBottom: '1px solid #e0e0e0' }}>
                <ListItemText primary={text} />
            </ListItem>
        ))}
    </List>
);

export default GridTestPage;
