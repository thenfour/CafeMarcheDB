import React from "react";
import { Backdrop, Box, Button, FormHelperText, InputLabel, MenuItem, Popover, Select, Tooltip } from "@mui/material";
import { ColorPalette, ColorPaletteEntry, ColorPaletteList, CreateColorPaletteEntry } from "shared/color";
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
    showStrong: boolean;
    showWeak: boolean;
};


export const NullColorSwatch = (props: ColorSwatchProps) => {

    const style = {
        "--strong-color": "#fff8",
        "--strong-contrast-color": "#0008",
        "--strong-border-color": "#0008",
        "--strong-border-style": "dotted",
        "--weak-color": "#fff8",
        "--weak-contrast-color": "#0008",
        "--weak-border-color": "#0008",
        "--weak-border-style": "dotted",
    };
    return <div className={`${props.selected ? "selected" : ""} colorSwatchRoot nullValue `} style={style as React.CSSProperties}>
        {props.showStrong &&
            //<Tooltip title={`(none)`}>
            <div className="strong">
                (none)
            </div>
            //</Tooltip>
        }
        {props.showWeak &&
            //<Tooltip title={`(none)`}>
            <div className="weak">
                (none)
            </div>
            //</Tooltip>
        }
    </div>;
}

// props.color can never be null.
export const ColorSwatch = (props: ColorSwatchProps) => {
    if (props.color == null) {
        return <NullColorSwatch {...props} />;
    }
    const entry = props.color;

    const style = {
        "--strong-color": entry.strongValue,
        "--strong-contrast-color": entry.strongContrastColor,
        "--strong-border-color": entry.strongOutline ? entry.strongContrastColor : "#d8d8d8",
        "--strong-border-style": (props.color == null) ? "dotted" : (props.color.strongOutline ? "solid" : "hidden"),
        "--weak-color": entry.weakValue,
        "--weak-contrast-color": entry.weakContrastColor,
        "--weak-border-color": entry.weakOutline ? entry.weakContrastColor : "#d8d8d8",
        "--weak-border-style": (props.color == null) ? "dotted" : (props.color.weakOutline ? "solid" : "hidden"),
    };
    return <div className={`${props.selected ? "selected" : ""} colorSwatchRoot ${props.isSpacer ? "spacer" : ""}`} style={style as React.CSSProperties}>
        {props.showStrong &&
            //<Tooltip title={`${entry.strongValue}\r\n${entry.strongContrastColor}`}>
            <div className="strong">
                {entry.label}
            </div>
            //</Tooltip>
        }
        {props.showWeak &&
            // <Tooltip title={`${entry.weakValue}\r\n${entry.weakContrastColor}`}>
            <div className="weak">
                {entry.label}
            </div>
            // </Tooltip>
        }
    </div>;
};

export interface ColorPaletteGridProps {
    palette: ColorPalette;
    showNull: boolean;
    onClick: (value: ColorPaletteEntry | null) => void;
    showStrong: boolean;
    showWeak: boolean;
};

export const ColorPaletteGrid = ({ showStrong, showWeak, ...props }: ColorPaletteGridProps) => {
    return <div className="colorPaletteGridRoot">
        {
            props.palette.getAllRowsAndEntries().map((row, rowIndex) => {
                return <div className="row" key={rowIndex}>
                    {
                        props.showNull && (
                            (rowIndex === 0) ? (<div onClick={() => { props.onClick(null) }}><ColorSwatch selected={false} color={null} isSpacer={true} showStrong={showStrong} showWeak={showWeak} /></div>)
                                : (<ColorSwatch selected={false} color={null} isSpacer={true} showStrong={showStrong} showWeak={showWeak} />)
                        )
                    }
                    {row.map((e, i) => {
                        return <div onClick={() => { props.onClick(e) }} key={i} ><ColorSwatch selected={false} color={e} showStrong={showStrong} showWeak={showWeak} /></div>;

                    })}
                </div>;
            })
        }
    </div>;
};

export interface ColorPaletteListComponentProps {
    palettes: ColorPaletteList;
    onClick: (value: ColorPaletteEntry | null) => void;
    allowNull: boolean;
};

export const ColorPaletteListComponent = (props: ColorPaletteListComponentProps) => {
    const [bgColor, setBgColor] = React.useState<string>("black");
    const [swatchWidth, setSwatchWidth] = React.useState<number>(70);
    const [swatchHeight, setSwatchHeight] = React.useState<number>(80);
    const [showStrong, setShowStrong] = React.useState<boolean>(true);
    const [showWeak, setShowWeak] = React.useState<boolean>(true);
    const style = {
        "--background-color": bgColor,
        "--swatch-width": `${swatchWidth}px`,
        "--swatch-height": `${swatchHeight}px`,
    } as React.CSSProperties;
    return <div className="colorPaletteListRoot" style={style}>
        <div className="buttonGroup">
            <div className="smallButton" onClick={() => { setBgColor("black") }}>black</div>
            <div className="smallButton" onClick={() => { setBgColor("#eee") }}>gray</div>
            <div className="smallButton" onClick={() => { setBgColor("white") }}>white</div>
            <div className="smallButton" onClick={() => { setShowStrong(!showStrong) }}>strong</div>
            <div className="smallButton" onClick={() => { setShowWeak(!showWeak) }}>weak</div>
        </div>
        {
            props.palettes.palettes.map((palette, index) => {
                return <ColorPaletteGrid onClick={props.onClick} key={index} palette={palette} showNull={index === 0 && props.allowNull} showStrong={showStrong} showWeak={showWeak} />;
            })
        }
    </div>;
};

export interface ColorPickProps {
    value: ColorPaletteEntry | null;
    allowNull: boolean;
    palettes: ColorPaletteList;
    onChange: (value: ColorPaletteEntry | null) => void;
};

// props.color can never be null.
export const ColorPick = (props: ColorPickProps) => {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const isOpen = Boolean(anchorEl);
    const entry = props.value;

    const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    return <>
        <div onClick={handleOpen}>
            <ColorSwatch selected={true} color={entry} showStrong={true} showWeak={true} />
        </div>
        <Popover
            anchorEl={anchorEl}
            open={isOpen}
            onClose={() => setAnchorEl(null)}
        >
            <ColorPaletteListComponent allowNull={props.allowNull} palettes={props.palettes} onClick={(e: ColorPaletteEntry | null) => {
                props.onChange(e);
                setAnchorEl(null);
            }}
            />
        </Popover >
    </>;
};
