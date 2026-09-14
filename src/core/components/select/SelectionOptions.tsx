import CloseIcon from "@mui/icons-material/Close";
import { Box, Checkbox, IconButton, Typography } from "@mui/material";
import React from "react";

// CMChip normally uses min-content width with nowrap. Allow wrapping without collapsing it.
const selectionValueSx = {
    minWidth: 0,
    "& .CMChip": { width: "max-content", maxWidth: "100%" },
    "& .CMChip .chipMain": { minWidth: 0 },
    "& .CMChip .content": { whiteSpace: "normal", overflowWrap: "anywhere" },
};

export const SelectionCheckboxRow = (props: React.PropsWithChildren<{
    label: string;
    selected: boolean;
    disabled?: boolean;
    onToggle: () => void;
}>) => <Box component="li" sx={{ listStyle: "none", borderBottom: "1px solid", borderColor: "divider", "&:last-child": { borderBottom: 0 } }}>
    <Box component="label" sx={{
        display: "flex", alignItems: "center", gap: 1, px: 2, py: 0.5, minHeight: 52,
        cursor: props.disabled ? "default" : "pointer",
        bgcolor: props.selected ? "action.selected" : "background.paper",
        opacity: props.disabled ? 0.6 : 1,
        "&:hover": { bgcolor: props.disabled ? undefined : "action.hover" },
        "&:focus-within": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: -2 },
    }}>
        <Checkbox
            checked={props.selected}
            disabled={props.disabled}
            onChange={props.onToggle}
            inputProps={{ "aria-label": props.label }}
        />
        <Box sx={{ ...selectionValueSx, flex: 1 }}>
            {props.children}
        </Box>
    </Box>
</Box>;

interface SelectionValueListProps<T> {
    value: T[];
    getKey: (value: T) => React.Key;
    getLabel: (value: T) => string;
    renderValue: (value: T) => React.ReactNode;
    onRemove?: (value: T) => void;
    disabled?: boolean;
}

// Domain renderers supply the value; this component owns accessible removal controls.
export const SelectionValueList = <T,>(props: SelectionValueListProps<T>) => <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.5, minWidth: 0 }}>
    {props.value.length === 0 && <Typography variant="body2" color="text.secondary">None selected</Typography>}
    {props.value.map(value => <Box key={props.getKey(value)} sx={{ display: "inline-flex", alignItems: "center", minWidth: 0, maxWidth: "100%" }}>
        <Box sx={selectionValueSx}>{props.renderValue(value)}</Box>
        {props.onRemove && <IconButton
            type="button"
            size="small"
            aria-label={`Remove ${props.getLabel(value)}`}
            disabled={props.disabled}
            onClick={() => props.onRemove!(value)}
            sx={{ width: 44, height: 44, flexShrink: 0 }}
        ><CloseIcon fontSize="small" /></IconButton>}
    </Box>)}
</Box>;
