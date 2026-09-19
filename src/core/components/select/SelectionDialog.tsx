import SearchIcon from "@mui/icons-material/Search";
import { Box, InputAdornment, TextField, Typography } from "@mui/material";
import React from "react";
import { CMDialog } from "../CMDialog";
import { CMButton } from "../CMCoreComponents2";

interface SelectionDialogProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    summary: React.ReactNode;
    filterText: string;
    onFilterTextChange: (value: string) => void;
    onCancel: () => void;
    onApply?: () => void;
    applyDisabled?: boolean;
    busy?: boolean;
    allowQuickFilter?: boolean;
}

// Callers can accept an option immediately, or provide Apply to confirm a draft.
export const SelectionDialog = (props: React.PropsWithChildren<SelectionDialogProps>) => {
    const titleId = React.useId();
    const descriptionId = React.useId();
    const titleRef = React.useRef<HTMLHeadingElement>(null);

    return <CMDialog
        open
        className="CMSelectionDialog"
        fillHeight
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClose={() => { if (!props.busy) props.onCancel(); }}
        // Keep keyboard activation inside a nested editor, without swallowing button clicks.
        onKeyDown={event => { if (event.key === "Enter") event.stopPropagation(); }}
        TransitionProps={{ onEntered: () => titleRef.current?.focus() }}
        title={props.title}
        titleProps={{ id: titleId, ref: titleRef, tabIndex: -1, sx: { p: 0, outline: "none" } }}
        headerProps={{ sx: { p: 3, pb: 2 } }}
        header={<>
            <Box id={descriptionId} sx={{ mt: 1, color: "text.secondary", fontSize: 14 }}>
                {props.description || "Choose one or more options."}
            </Box>
            {props.allowQuickFilter !== false && <TextField
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
            />}
            {props.summary}
        </>}
        contentProps={{ sx: { p: 0 } }}
        actions={<>
            <CMButton type="button" disabled={props.busy} onClick={props.onCancel}>Cancel</CMButton>
            {props.onApply && <CMButton type="button" disabled={props.applyDisabled || props.busy} onClick={props.onApply}>Apply</CMButton>}
        </>}
        sx={{
            "& .MuiButton-root": { textTransform: "none" },
            "& .MuiDialog-paper": {
                width: "min(600px, calc(100vw - 48px))",
                minWidth: 0,
            },
            "&.smallScreen .MuiDialog-paper": {
                width: "100%",
            },
        }}
    >
        {props.children}
    </CMDialog>;
};

export const SelectionSummary = (props: React.PropsWithChildren<{ count: number }>) => {
    const [expanded, setExpanded] = React.useState(false);
    const valuesId = React.useId();

    return <Box>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}>
            <Typography component="span" variant="body2" color="text.secondary" role="status">
                {props.count === 0 ? "None selected" : `${props.count} selected`}
            </Typography>
            {props.count > 0 && <CMButton
                type="button"
                //size="small"
                aria-expanded={expanded}
                aria-controls={valuesId}
                onClick={() => setExpanded(value => !value)}
            //sx={{ minHeight: 44 }}
            >{expanded ? "Hide selected" : "Show selected"}</CMButton>}
        </Box>
        <Box id={valuesId} hidden={!expanded || props.count === 0} sx={{ maxHeight: 112, overflowY: "auto" }}>
            {expanded && props.count > 0 && props.children}
        </Box>
    </Box>;
};
