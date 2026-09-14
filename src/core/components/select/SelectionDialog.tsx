import SearchIcon from "@mui/icons-material/Search";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, TextField, Typography, useMediaQuery, useTheme } from "@mui/material";
import React from "react";

interface SelectionDialogProps {
    title: string;
    description?: React.ReactNode;
    summary: React.ReactNode;
    filterText: string;
    onFilterTextChange: (value: string) => void;
    onCancel: () => void;
    onApply: () => void;
    applyDisabled?: boolean;
    busy?: boolean;
}

// A selection dialog edits a draft. Its caller decides whether applying that draft saves it.
export const SelectionDialog = (props: React.PropsWithChildren<SelectionDialogProps>) => {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down("md"));
    const titleId = React.useId();
    const descriptionId = React.useId();
    const titleRef = React.useRef<HTMLHeadingElement>(null);

    return <Dialog
        open
        fullScreen={fullScreen}
        className="CMSelectionDialog"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClose={() => { if (!props.busy) props.onCancel(); }}
        // Keep keyboard activation inside a nested editor, without swallowing button clicks.
        onKeyDown={event => { if (event.key === "Enter") event.stopPropagation(); }}
        TransitionProps={{ onEntered: () => titleRef.current?.focus() }}
        sx={{
            "& .MuiButton-root": { textTransform: "none" },
            "& .MuiDialog-container": {
                paddingTop: fullScreen ? 0 : "32px",
                paddingBottom: "var(--media-bar-height, 0px)",
            },
            "& .MuiDialog-paper": {
                m: 0,
                width: fullScreen ? "100%" : "min(600px, calc(100vw - 48px))",
                minWidth: 0,
                height: fullScreen ? "calc(100dvh - var(--media-bar-height, 0px))" : "min(660px, calc(100dvh - 64px - var(--media-bar-height, 0px)))",
                maxHeight: "calc(100dvh - var(--media-bar-height, 0px))",
                borderRadius: fullScreen ? 0 : 2,
            },
        }}
    >
        <Box sx={{ p: 3, pb: 2, flexShrink: 0 }}>
            <DialogTitle id={titleId} ref={titleRef} tabIndex={-1} sx={{ p: 0, outline: "none" }}>{props.title}</DialogTitle>
            <Box id={descriptionId} sx={{ mt: 1, color: "text.secondary", fontSize: 14 }}>
                {props.description || "Choose one or more options."}
            </Box>
            <TextField
                fullWidth
                size="small"
                type="search"
                placeholder="Search options"
                value={props.filterText}
                disabled={props.busy}
                onChange={event => props.onFilterTextChange(event.target.value)}
                onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }}
                inputProps={{ "aria-label": "Search options", style: { fontSize: 16 }, autoComplete: "off" }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                sx={{ mt: 2, mb: 1 }}
            />
            {props.summary}
        </Box>
        <DialogContent dividers sx={{ p: 0, minHeight: 0, overscrollBehavior: "contain" }}>
            {props.children}
        </DialogContent>
        <DialogActions sx={{
            flexShrink: 0, gap: 1, px: 3, pt: 2,
            pb: "max(16px, env(safe-area-inset-bottom))",
            "& .MuiButton-root": { minHeight: 44, minWidth: 88, ml: 0, flex: fullScreen ? 1 : undefined },
        }}>
            <Button type="button" disabled={props.busy} onClick={props.onCancel}>Cancel</Button>
            <Button type="button" variant="contained" disabled={props.applyDisabled || props.busy} onClick={props.onApply}>Apply</Button>
        </DialogActions>
    </Dialog>;
};

export const SelectionSummary = (props: React.PropsWithChildren<{ count: number }>) => {
    const [expanded, setExpanded] = React.useState(false);
    const valuesId = React.useId();

    return <Box>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}>
            <Typography component="span" variant="body2" color="text.secondary" role="status">
                {props.count === 0 ? "None selected" : `${props.count} selected`}
            </Typography>
            {props.count > 0 && <Button
                type="button"
                size="small"
                aria-expanded={expanded}
                aria-controls={valuesId}
                onClick={() => setExpanded(value => !value)}
                sx={{ minHeight: 44 }}
            >{expanded ? "Hide selected" : "Show selected"}</Button>}
        </Box>
        <Box id={valuesId} hidden={!expanded || props.count === 0} sx={{ maxHeight: 112, overflowY: "auto" }}>
            {expanded && props.count > 0 && props.children}
        </Box>
    </Box>;
};
