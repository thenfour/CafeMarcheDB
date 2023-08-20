import React from "react";
import { Backdrop, Box, Button, FormHelperText, InputLabel, MenuItem, Popover, Select, Tooltip } from "@mui/material";
import { ColorPalette, ColorPaletteEntry, CreateColorPaletteEntry, CreateNullPaletteEntry } from "shared/color";
import { gNullValue, getNextSequenceId } from "shared/utils";
//import "../../../public/style/color.css"

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
    isSpacer?: boolean;
};


// props.color can never be null.
export const ColorSwatch = (props: ColorSwatchProps) => {
    const entry = props.color || CreateNullPaletteEntry();

    const style = {
        "--strong-color": entry.strongValue,
        "--strong-contrast-color": entry.strongContrastColor,
        "--strong-border-color": entry.outline ? entry.strongContrastColor : "#d8d8d8",
        "--weak-color": entry.weakValue,
        "--weak-contrast-color": entry.weakContrastColor,
        "--weak-border-color": entry.outline ? entry.weakContrastColor : "#d8d8d8",
        "--border-style": (props.color == null) ? "dotted" : "solid",
    };
    return <div className={`${props.selected ? "selected" : ""} colorSwatchRoot ${props.isSpacer ? "spacer" : ""}`} style={style as React.CSSProperties}>
        <Tooltip title={`${entry.strongValue}\r\n${entry.strongContrastColor}`}><div className="strong">
            {entry.label}
        </div></Tooltip>
        <Tooltip title={`${entry.weakValue}\r\n${entry.weakContrastColor}`}><div className="weak">
            {entry.label}
        </div></Tooltip>
    </div>;
};

export interface ColorPaletteGridProps {
    palette: ColorPalette;
    showNull: boolean;
    onClick: (value: ColorPaletteEntry) => void;
};

export const ColorPaletteGrid = (props: ColorPaletteGridProps) => {
    return <div className="colorPaletteGridRoot">
        {
            props.palette.getAllRowsAndEntries().map((row, rowIndex) => {
                return <div className="row" key={rowIndex}>
                    {
                        props.showNull && (
                            (rowIndex === 0) ? (<ColorSwatch selected={false} color={null} isSpacer={true} />)
                                : (<ColorSwatch selected={false} color={null} isSpacer={true} />)
                        )
                    }
                    {row.map(e => {
                        return <ColorSwatch selected={false} key={e.id || gNullValue} color={e} />;

                    })}
                </div>;
            })
        }
    </div>;
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
    const entry = props.value || props.palette.defaultEntry;

    const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    return <>
        {/* <Backdrop open={true}> */}
        <Tooltip title={entry.label}>
            <Button onClick={handleOpen}><ColorSwatch selected={true} color={entry} /></Button>
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
