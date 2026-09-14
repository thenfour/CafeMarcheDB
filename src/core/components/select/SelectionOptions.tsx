import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import { Box, ButtonBase, Checkbox, IconButton, Radio, Typography } from "@mui/material";
import React from "react";
import { CMChipContainer } from "../CMChip";

// CMChip normally uses min-content width with nowrap. Allow wrapping without collapsing it.
const selectionValueSx = {
    minWidth: 0,
    "& .CMChip": { width: "max-content", maxWidth: "100%" },
    "& .CMChip .chipMain": { minWidth: 0 },
    "& .CMChip .content": { whiteSpace: "normal", overflowWrap: "anywhere" },
};

export const SelectionValue = (props: React.PropsWithChildren) => <Box sx={selectionValueSx}>{props.children}</Box>;

interface SelectionRowProps {
    label: string;
    selected: boolean;
    disabled?: boolean;
}

const selectionRowSx = (props: SelectionRowProps) => ({
    display: "flex", alignItems: "center", gap: 1, px: 2, py: 0.5, minHeight: 52,
    width: "100%", textAlign: "left",
    cursor: props.disabled ? "default" : "pointer",
    bgcolor: props.selected ? "action.selected" : "background.paper",
    opacity: props.disabled ? 0.6 : 1,
    "&:hover": { bgcolor: props.disabled ? undefined : "action.hover" },
    "&:focus-within": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: -2 },
} as const);

const SelectionListItem = (props: React.PropsWithChildren) => <Box component="li" sx={{ listStyle: "none", borderBottom: "1px solid", borderColor: "divider", "&:last-child": { borderBottom: 0 } }}>
    {props.children}
</Box>;

export const SelectionCheckboxRow = (props: React.PropsWithChildren<SelectionRowProps & {
    onToggle: () => void;
}>) => <SelectionListItem>
        <Box component="label" sx={selectionRowSx(props)}>
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
    </SelectionListItem>;

// RadioGroup supplies the shared name and native arrow-key selection behavior.
export const SelectionRadioRow = (props: React.PropsWithChildren<SelectionRowProps & {
    value: string;
    onSelect: () => void;
}>) => <SelectionListItem>
        <Box component="label" sx={selectionRowSx(props)}>
            <Radio value={props.value} checked={props.selected} disabled={props.disabled} onChange={props.onSelect} inputProps={{ "aria-label": props.label }} />
            <Box sx={{ ...selectionValueSx, flex: 1 }}>{props.children}</Box>
        </Box>
    </SelectionListItem>;

// A quick choice is an action: keyboard focus can move without accepting a value.
export const SelectionActionRow = (props: React.PropsWithChildren<SelectionRowProps & {
    onSelect: () => void;
}>) => <SelectionListItem>
        <ButtonBase type="button" disabled={props.disabled} onClick={props.onSelect} aria-label={props.label} aria-current={props.selected ? "true" : undefined} sx={selectionRowSx(props)}>
            <Box component="span" sx={{ width: 42, flexShrink: 0, display: "flex", justifyContent: "center", color: "primary.main" }}>
                {props.selected && <CheckIcon />}
            </Box>
            <Box component="span" sx={{ ...selectionValueSx, flex: 1 }}>{props.children}</Box>
        </ButtonBase>
    </SelectionListItem>;

interface SelectionValueListProps<T> {
    value: T[];
    getKey: (value: T) => React.Key;
    getLabel: (value: T) => string;
    renderValue: (value: T) => React.ReactNode;
    onRemove?: (value: T) => void;
    disabled?: boolean;
    children?: React.ReactNode;
    style?: React.CSSProperties;
}

// Domain renderers supply the value; this component owns accessible removal controls.
export const SelectionValueList = <T,>(props: SelectionValueListProps<T>) => (
    <Box component={CMChipContainer} sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.5, minWidth: 0 }} style={props.style}>
        {props.value.length === 0 && <Typography variant="body2" color="text.secondary">None selected</Typography>}
        {props.value.map(value => <Box key={props.getKey(value)} sx={{ display: "inline-flex", alignItems: "center", minWidth: 0, maxWidth: "100%" }}>
            <SelectionValue>{props.renderValue(value)}</SelectionValue>
            {props.onRemove && <IconButton
                type="button"
                size="small"
                aria-label={`Remove ${props.getLabel(value)}`}
                disabled={props.disabled}
                onClick={() => props.onRemove!(value)}
                sx={{ width: 44, height: 44, flexShrink: 0 }}
            ><CloseIcon fontSize="small" /></IconButton>}
        </Box>)}
        {props.children}
    </Box>);
