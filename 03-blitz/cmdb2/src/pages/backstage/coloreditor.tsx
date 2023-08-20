import React, { FC, Suspense } from "react"
import { BlitzPage, useParams } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { Breadcrumbs, Button, Link, List, ListItem, Radio, Typography } from "@mui/material";
import HomeIcon from '@mui/icons-material/Home';
import { EventDetail } from "src/core/components/CMComponents";
import { ColorPalette, ColorPaletteEntry, CreateColorPaletteEntry } from "shared/color";
import { ColorPaletteGrid, ColorSwatch } from "src/core/components/Color";
import { gNullValue, lerp } from "shared/utils";

// interface ColorEditProps {
//     value: ColorPaletteEntry;
//     onChange: (value: ColorPaletteEntry) => void;
// };

// const ColorEdit = (props: ColorEditProps) => {

// };

// interface PaletteEditProps {
//     value: ColorPalette;
//     onChange: (value: ColorPalette) => void;
// };
// const PaletteEdit = (props: PaletteEditProps) => {
//     return <></>;
// };

// hue 0-360
// sat 0-100%
// brightness 0-100%
// alpha
//color:hsla(0, 69%, 31%, 0.698);

type PaletteGenValueType = "fixed" | "distribute";
type PaletteGenValueFormat = "percent" | "float" | "int";
type PaletteGenValueBounds = "clamp" | "wrap";

interface PaletteGenValueArgs {
    realMin: number;
    realMax: number;
    format: PaletteGenValueFormat;
    bounds: PaletteGenValueBounds;
}

class PaletteGenValue {
    realMin: number;
    realMax: number;
    format: PaletteGenValueFormat;
    bounds: PaletteGenValueBounds;

    minVal01: number;
    maxVal01: number;
    offset01: number;
    type: PaletteGenValueType;

    constructor(args: PaletteGenValueArgs) {
        this.realMin = args.realMin;
        this.realMax = args.realMax;
        this.format = args.format;
        this.bounds = args.bounds;

        this.minVal01 = 0;
        this.maxVal01 = 1;
        this.offset01 = 0;
        this.type = "distribute";
    }

    valueAsString = (t01, modAddN11, modMul01) => {
        let x = modAddN11;
        if (this.type === "distribute") {
            x += t01;
        }
        x *= modMul01;

        // minmax to specified range
        x = lerp(this.minVal01, this.maxVal01, x);
        x += this.offset01; // doing this after ranging allows wrap behavior

        // bounds behavior ensuring a 0-1 value
        if (this.bounds === "clamp") {
            if (x < 0) x = 0;
            if (x > 1) x = 1;
        } else if (this.bounds === "wrap") {
            x = x % 1;
        }

        // convert to external units
        x = lerp(this.realMin, this.realMax, x);
        switch (this.format) {
            case "float":
                return `${x}`;
            case "int":
                return `${Math.round(x)}`;
            case "percent":
                return `${Math.round(x)}%`;
        }
    };

}
interface PaletteGenValueControlProps {
    value: PaletteGenValue;
    onChange: (value: PaletteGenValue) => void;
    caption: string;
};

const PaletteGenValueControl = (props: PaletteGenValueControlProps) => {
    //console.log(`input val : ${props.value.offset01 * 100}`);
    return <div className="controlRow">
        <div className="caption">{props.caption} - offset ({props.value.offset01})</div>
        <input type="range" min="0" max="100" value={props.value.offset01 * 100} onChange={(e) => {
            props.value.offset01 = parseFloat(e.target.value) / 100;
            props.onChange(props.value);
        }}></input>
        <div className="caption">min ({props.value.minVal01})</div>
        <input type="range" min="0" max="100" value={props.value.minVal01 * 100} onChange={(e) => {
            props.value.minVal01 = parseFloat(e.target.value) / 100;
            props.onChange(props.value);
        }}></input>
        <div className="caption">max ({props.value.maxVal01})</div>
        <input type="range" min="0" max="100" value={props.value.maxVal01 * 100} onChange={(e) => {
            props.value.maxVal01 = parseFloat(e.target.value) / 100;
            props.onChange(props.value);
        }}></input>
        <div className="caption">{props.value.type}</div>
        <Radio
            checked={props.value.type === "distribute"}
            onChange={() => {
                props.value.type = "distribute";
                props.onChange(props.value);
            }}
        />
        <Radio
            checked={props.value.type === "fixed"}
            onChange={() => {
                props.value.type = "fixed";
                props.onChange(props.value);
            }}
        />
    </div>;
};

class PaletteGenParams {
    hue: PaletteGenValue;
    sat: PaletteGenValue;
    lum: PaletteGenValue;
    alpha: PaletteGenValue;

    entryCount: number;
    columnCount: number;

    constructor() {
        this.hue = new PaletteGenValue({ realMin: 0, realMax: 360, format: "int", bounds: "wrap" });
        this.sat = new PaletteGenValue({ realMin: 0, realMax: 100, format: "percent", bounds: "clamp" });
        this.lum = new PaletteGenValue({ realMin: 0, realMax: 100, format: "percent", bounds: "clamp" });
        this.alpha = new PaletteGenValue({ realMin: 0, realMax: 1, format: "float", bounds: "clamp" });
    }
    copy = () => {
        return Object.assign({}, this);
    }
    generatePalette = () => {
        const ret = new ColorPalette({ columns: this.columnCount, defaultIndex: 0, entries: [] });
        for (let i = 0; i < this.entryCount; ++i) {
            const t01 = i / this.entryCount;
            const shue = this.hue.valueAsString(t01, 0, 1);
            const ssat = this.sat.valueAsString(t01, 0, 1);
            const slum = this.lum.valueAsString(t01, 0, 1);
            const salpha = this.alpha.valueAsString(t01, 0, 1);
            const e = CreateColorPaletteEntry();
            //e.id = `${getNextSequenceId()}`;
            e.id = `${i}`;
            e.strongValue = `hsla(${shue}, ${ssat}, ${slum}, ${salpha})`;
            e.strongContrastColor = `black`;
            e.weakValue = `hsla(${shue}, ${ssat}, ${slum}, ${salpha})`;
            e.weakContrastColor = `black`;
            ret.entries.push(e);
            // e.weakvalue
            // e.weakcontrastcolor
        };
        //console.log(ret);
        return ret;
    }
}

interface PaletteGenControlsProps {
    value: PaletteGenParams;
    onChange: (value: PaletteGenParams) => void;
};

const PaletteGenControls = (props: PaletteGenControlsProps) => {
    return <div>
        <PaletteGenValueControl
            value={props.value.hue}
            caption="hue"
            onChange={(value) => {
                props.value.hue = value;
                props.onChange(props.value);
            }}
        />
        <PaletteGenValueControl
            value={props.value.sat}
            caption="sat"
            onChange={(value) => {
                props.value.sat = value;
                props.onChange(props.value);
            }}
        />
        <PaletteGenValueControl
            value={props.value.lum}
            caption="lum"
            onChange={(value) => {
                props.value.lum = value;
                props.onChange(props.value);
            }}
        />
        <PaletteGenValueControl
            value={props.value.alpha}
            caption="alpha"
            onChange={(value) => {
                props.value.alpha = value;
                props.onChange(props.value);
            }}
        />
    </div>
        ;
};



const MyComponent = () => {
    //const [selectedColor, setSelectedColor] = React.useState<ColorPaletteEntry>();
    const [dumdum, setDumDum] = React.useState(0);
    const [genParams, setGenParams] = React.useState<PaletteGenParams>(new PaletteGenParams());

    const palette = genParams.generatePalette();
    //console.log(palette);

    const EntryCountSelect = (props) => {
        return <Button className={`${props.value === props.selectedValue ? "selected" : ""}`} onClick={() => {
            genParams.entryCount = props.value;
            setGenParams(genParams);
            setDumDum(dumdum + 1);
        }}>{props.value}</Button>;
    };

    const ColumnCountSelect = (props) => {
        return <Button className={`${props.value === props.selectedValue ? "selected" : ""}`} onClick={() => {
            genParams.columnCount = props.value;
            setGenParams(genParams);
            setDumDum(dumdum + 1);
        }}>{props.value}</Button>;
    };

    const numberOptions = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];

    const onCopy = async () => {
        const txt = JSON.stringify(genParams);
        navigator.clipboard.writeText(txt).then(() => {
            alert(`copied ${txt.length} chars`);
        });
    };

    const onPaste = async () => {
        // try {
        //     console.log(`Logging old values as a last-resort backup...`);
        //     console.log(items);
        //     const txt = await navigator.clipboard.readText();
        //     const obj = JSON.parse(txt);
        //     // obj should be an array of { name, value }
        //     if (!Array.isArray(obj)) {
        //         showSnackbar({ severity: "error", children: `Clipboard text is not an array` });
        //         return;
        //     }

        //     showSnackbar({ severity: "success", children: `Updated ${items.length} settings` });

        // } catch (e) {
        //     console.log(e);
        //     showSnackbar({ severity: "error", children: `Error while pasting; maybe invalid format?...` });
        // }
    };

    return <div className="paletteeditor">
        <Button onClick={onCopy}>Copy to clipboard</Button>
        <Button onClick={onPaste}>Paste from clipboard</Button>
        <div className="">palette has {palette.entries.length} entries.</div>
        {
            numberOptions.map(i => <EntryCountSelect key={i} value={i} selectedValue={genParams.entryCount} />)
        }
        <div className="columnCount">columns</div>
        {
            numberOptions.map(i => <ColumnCountSelect key={i} value={i} selectedValue={genParams.columnCount} />)
        }

        <PaletteGenControls value={genParams} onChange={(v) => {
            setGenParams(genParams);
            setDumDum(dumdum + 1);
        }} />

        <ColorPaletteGrid palette={palette} onClick={(e) => { }} />
        {/* <ul>
            {palette.entries.map(entry => {
                return <li key={entry.id || gNullValue}>
                    <div
                        onClick={() => { setSelectedColor(entry) }}
                    >
                        <ColorSwatch color={entry} selected={selectedColor.id === entry.id} />
                    </div>
                </li>;
            })}
        </ul> */}
    </div>;
};


const ColorEditPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Instrument">
            <MyComponent></MyComponent>
        </DashboardLayout>
    )
}

export default ColorEditPage;
