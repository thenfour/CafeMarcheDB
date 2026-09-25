import { makeServerSidePermissionGuard } from "@/src/auth/server/serverPageAuthorization";
import { CMDialog, useDialogAfterMenuClose } from "@/src/core/components/CMDialog";
import { CMButton } from "@/src/core/components/CMCoreComponents2";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { Markdown3Editor } from "@/src/core/components/markdown/MarkdownControl3";
import { useMediaPlayer } from "@/src/core/components/mediaPlayer/MediaPlayerContext";
import { MediaPlayerTrack } from "@/src/core/components/mediaPlayer/MediaPlayerTypes";
import { BlitzPage } from "@blitzjs/next";
import { Box, Menu, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import React from "react";
import { Permission } from "shared/permissions";

import { createDraftSetlistId } from "@db3/shared/entities/eventSongList/eventSongListDraft";

type DialogExample = "compact" | "long" | "keyboard" | "setlist" | null;

const kDialogTestMediaSetlistId = createDraftSetlistId();
const dialogTestMediaTrack: MediaPlayerTrack = {
    playlistIndex: 0,
    setlistClientId: kDialogTestMediaSetlistId,
    songContext: {
        id: -8675309,
        name: "Dialog UX media-bar fixture",
        pinnedRecordingId: null,
        lengthSeconds: 245,
    },
};

const DialogUxExamples = () => {
    const mediaPlayer = useMediaPlayer();
    const [example, setExample] = React.useState<DialogExample>(null);
    const [result, setResult] = React.useState("No dialog action yet.");
    const [name, setName] = React.useState("");
    const [notes, setNotes] = React.useState("");
    const [setlistDescription, setSetlistDescription] = React.useState("A realistic markdown editor for checking the setlist dialog width and toolbar wrapping.");
    const [menuAnchor, setMenuAnchor] = React.useState<HTMLElement | null>(null);
    const menuDialog = useDialogAfterMenuClose();
    const playlistRef = React.useRef(mediaPlayer.playlist);
    playlistRef.current = mediaPlayer.playlist;

    const testMediaBarActive = mediaPlayer.currentTrack?.setlistClientId === kDialogTestMediaSetlistId;
    const otherMediaActive = mediaPlayer.playlist.length > 0 && !testMediaBarActive;

    React.useEffect(() => {
        return () => {
            if (playlistRef.current.some(track => track.setlistClientId === kDialogTestMediaSetlistId)) {
                mediaPlayer.setPlaylist([], undefined);
            }
        };
    }, [mediaPlayer.setPlaylist]);

    const close = (message: string) => {
        setResult(message);
        setExample(null);
    };

    return <Box sx={{ maxWidth: 900, mx: "auto", p: { xs: 2, md: 3 } }}>
        <Typography variant="h4" component="h1">Dialog mobile UX</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
            Manual fixtures for visual-viewport sizing, independently scrolling content, and actions which remain visible above mobile keyboards and the media bar.
        </Typography>

        <Paper variant="outlined" sx={{ p: 2.5, my: 3 }}>
            <Typography variant="h6" component="h2">Scenarios</Typography>
            <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1.5} sx={{ mt: 2 }}>
                <CMButton onClick={() => setExample("compact")}>Compact confirmation</CMButton>
                <CMButton onClick={() => setExample("long")}>Long scrolling content</CMButton>
                <CMButton onClick={() => setExample("keyboard")}>Keyboard stress test</CMButton>
                <CMButton onClick={() => setExample("setlist")}>Setlist-width stress test</CMButton>
            </Stack>
            <Typography role="status" sx={{ mt: 2 }}>{result}</Typography>
        </Paper>

        <Paper component="section" variant="outlined" sx={{ p: 2.5, mb: 3 }}>
            <Typography variant="h6" component="h2">Environment controls</Typography>
            <Typography color="text.secondary" sx={{ my: 1 }}>
                The synthetic track uses the real dashboard media bar without loading or playing audio. If another playlist is already active, keep it and use that instead.
            </Typography>
            <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1.5}>
                <CMButton
                    enabled={!otherMediaActive && !testMediaBarActive}
                    onClick={() => mediaPlayer.setPlaylist([dialogTestMediaTrack], undefined)}
                >
                    Show test media bar
                </CMButton>
                <CMButton
                    enabled={testMediaBarActive}
                    onClick={() => mediaPlayer.setPlaylist([], undefined)}
                >
                    Hide test media bar
                </CMButton>
                <CMButton onClick={event => setMenuAnchor(event.currentTarget)}>Open menu-launch test</CMButton>
            </Stack>
            <Typography role="status" sx={{ mt: 1.5 }}>
                {testMediaBarActive
                    ? "Synthetic media bar is visible. Open any dialog scenario and verify the actions stay above it."
                    : otherMediaActive
                        ? "A real media playlist is active; it can be used for the media-bar checks."
                        : "No media bar is currently visible."}
            </Typography>
            <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
                TransitionProps={{ onExited: menuDialog.onMenuExited }}
            >
                <MenuItem onClick={() => menuDialog.requestOpen(() => setMenuAnchor(null))}>
                    Open dialog after this menu closes
                </MenuItem>
            </Menu>
        </Paper>

        <Paper component="section" variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="h6" component="h2">Mobile checklist</Typography>
            <ul>
                <li>Open the keyboard stress test and focus each field, including the last field.</li>
                <li>Verify Cancel and Save remain visible and tappable above the keyboard.</li>
                <li>Scroll the body: the title and actions should stay still.</li>
                <li>Dismiss and reopen the keyboard in portrait and landscape.</li>
                <li>Repeat while the site media player bar is visible.</li>
                <li>With a real playable track, use the media transport and seek/volume controls while a dialog is open; the player must remain fully interactive.</li>
                <li>Open the menu-launch test, close its dialog, and verify the page remains interactive.</li>
            </ul>
            <Typography variant="h6" component="h2" sx={{ mt: 2 }}>Live setlist scenario</Typography>
            <Typography>
                The complete editor depends on real event, song, recording, authorization, and drag/drop data. To test it, go to <a href="/backstage/events">Backstage Events</a>, open an event containing a setlist, and edit that setlist. On desktop the table and markdown toolbar should fit without a horizontal scrollbar; on mobile the dialog should remain full-screen and scroll vertically.
            </Typography>
        </Paper>

        <CMDialog
            open={example === "compact"}
            onClose={() => close("Compact dialog cancelled.")}
            title="Compact confirmation"
            actions={<>
                <CMButton onClick={() => close("Compact dialog cancelled.")}>Cancel</CMButton>
                <CMButton onClick={() => close("Compact dialog confirmed.")}>Confirm</CMButton>
            </>}
        >
            This dialog should use only the space its content needs on desktop and the available screen on mobile.
        </CMDialog>

        <CMDialog
            open={example === "long"}
            onClose={() => close("Long dialog closed.")}
            title="Long scrolling content"
            fillHeight
            actions={<CMButton onClick={() => close("Long dialog closed.")}>Close</CMButton>}
        >
            <Typography paragraph>The numbered rows should scroll without moving the title or Close button.</Typography>
            {Array.from({ length: 40 }, (_, index) => <Paper key={index} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                Content row {index + 1}
            </Paper>)}
        </CMDialog>

        <CMDialog
            open={example === "keyboard"}
            onClose={() => close("Keyboard test cancelled.")}
            title="Keyboard stress test"
            fillHeight
            actions={<>
                <CMButton onClick={() => close("Keyboard test cancelled.")}>Cancel</CMButton>
                <CMButton onClick={() => close(`Saved keyboard test: ${name || "unnamed"}.`)}>Save</CMButton>
            </>}
        >
            <Stack spacing={2}>
                <Typography>
                    Focus these fields to open the on-screen keyboard. The action row should stay above it while this content remains independently scrollable.
                </Typography>
                <TextField
                    autoFocus
                    label="Name near the top"
                    value={name}
                    onChange={event => setName(event.target.value)}
                    inputProps={{ style: { fontSize: 16 } }}
                />
                {Array.from({ length: 14 }, (_, index) => <Paper key={index} variant="outlined" sx={{ p: 1.5 }}>
                    Scroll spacer {index + 1}
                </Paper>)}
                <TextField
                    label="Notes at the bottom"
                    value={notes}
                    multiline
                    minRows={3}
                    onChange={event => setNotes(event.target.value)}
                    inputProps={{ style: { fontSize: 16 } }}
                />
            </Stack>
        </CMDialog>

        <CMDialog
            open={example === "setlist"}
            onClose={() => close("Setlist-width test closed.")}
            title="Setlist-width stress test"
            fillHeight
            fullWidth
            maxWidth="md"
            actions={<>
                <CMButton onClick={() => close("Setlist-width test cancelled.")}>Cancel</CMButton>
                <CMButton onClick={() => close("Setlist-width test saved.")}>Save</CMButton>
            </>}
        >
            <Typography paragraph>
                This reproduces the setlist editor&apos;s dense fixed columns and real markdown toolbar without requiring event data.
            </Typography>
            <Paper variant="outlined" sx={{ minWidth: { xs: 0, md: 700 }, mb: 2, overflow: "hidden" }}>
                {["Song", "Northern Lights", "Paper Spaceships", "An Extraordinarily Long Setlist Song"].map((song, index) => <Box
                    key={song}
                    sx={{
                        display: "grid",
                        gridTemplateColumns: {
                            xs: "24px minmax(120px, 1fr) 44px 44px",
                            sm: "32px minmax(260px, 1fr) 64px 64px minmax(160px, .8fr)",
                        },
                        gap: 1,
                        alignItems: "center",
                        p: 1,
                        borderTop: index === 0 ? 0 : 1,
                        borderColor: "divider",
                        fontWeight: index === 0 ? 700 : 400,
                        "& > :last-child": { display: { xs: "none", sm: "inline" } },
                    }}
                >
                    <span>{index === 0 ? "#" : index}</span>
                    <span>{song}</span>
                    <span>{index === 0 ? "Len" : `3:${20 + index}`}</span>
                    <span>{index === 0 ? "bpm" : 96 + index * 4}</span>
                    <span>{index === 0 ? "Comment" : "Editable row details"}</span>
                </Box>)}
            </Paper>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>Setlist description</Typography>
            <Markdown3Editor
                value={setlistDescription}
                onChange={setSetlistDescription}
                nominalHeight={160}
                allowUploads={false}
                startWithPreviewOpen={false}
            />
        </CMDialog>

        <CMDialog
            open={menuDialog.dialogOpen}
            onClose={menuDialog.closeDialog}
            title="Opened after a menu transition"
            actions={<CMButton onClick={menuDialog.closeDialog}>Close</CMButton>}
        >
            After closing this dialog, click elsewhere on the page. No invisible menu backdrop should remain.
        </CMDialog>
    </Box>;
};

const DialogUxTestPage: BlitzPage = () => <DashboardLayout title="Dialog UX test">
    <DialogUxExamples />
</DashboardLayout>;

export default DialogUxTestPage;
export const getServerSideProps = makeServerSidePermissionGuard(Permission.sysadmin);
