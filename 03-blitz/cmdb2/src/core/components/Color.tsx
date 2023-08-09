import React from "react";
import { Backdrop, Box, Button, FormHelperText, InputLabel, MenuItem, Popover, Select, Tooltip } from "@mui/material";
import { ColorPalette, ColorPaletteEntry, gNullColorPaletteEntry } from "shared/color";
import { gNullValue } from "shared/utils";

interface ColorPaletteFieldArgs {
    member: string,
    label: string,
    cellWidth: number,
    allowNull: boolean,
    palette: ColorPalette,
    initialNewItemValue: string | null;
};

export interface ColorSwatchProps {
    color: ColorPaletteEntry | null;
    selected: boolean;
};


// props.color can never be null.
export const ColorSwatch = (props: ColorSwatchProps) => {
    const entry = props.color || gNullColorPaletteEntry;
    const style = (entry.value === null) ? "dotted" : "solid";
    return <Tooltip title={entry.label}>
        <Box sx={{
            width: 25,
            height: 25,
            backgroundColor: entry.value,
            border: props.selected ? `2px ${style} #888` : `2px ${style} #d8d8d8`,
        }}>
        </Box>
    </Tooltip>;
};

export interface ColorPickProps {
    value: ColorPaletteEntry | null;
    palette: ColorPalette;
    onChange: (value: ColorPaletteEntry) => void;
};

// props.color can never be null.
export const ColorPick = (props: ColorPickProps) => {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const isOpen = Boolean(anchorEl);
    const entry = props.value || gNullColorPaletteEntry;

    const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    return <>
        {/* <Backdrop open={true}> */}
        <Tooltip title={entry.label}>
            <Button onClick={handleOpen}><ColorSwatch selected={true} color={props.value} /></Button>
        </Tooltip>
        <Popover
            anchorEl={anchorEl}
            open={isOpen}
            onClose={() => setAnchorEl(null)}
        // i really want this but can't make it work.
        //hideBackdrop={false}
        //BackdropProps={{ invisible: false }}
        //slotProps={{ backdrop: { className: "bleh" } }}
        >
            {
                props.palette.getAllRowsAndEntries().map((row, rowIndex) => {
                    return <Box key={rowIndex}>
                        {row.map(e => {
                            return <MenuItem sx={{ display: "inline-flex" }} key={e.value || gNullValue} onClick={() => {
                                props.onChange(e);
                                setAnchorEl(null);
                            }}> <ColorSwatch selected={e.value === entry.value} key={e.value || gNullValue} color={e} /></MenuItem>

                        })}
                    </Box>;
                })
            }
        </Popover >
        {/* </Backdrop> */}
    </>;
};
