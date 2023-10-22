import { BlitzPage } from "@blitzjs/next";
import { Button, Radio } from "@mui/material";
import React from "react";
import { ColorPaletteArgs, ColorPaletteEntry, PaletteGenParamGroup, PaletteGenParams, PaletteGenValue, gGeneralPaletteList } from "shared/color";
import { ColorPaletteGrid, ColorPaletteListComponent, ColorPick } from "src/core/components/Color";
import DashboardLayout from "src/core/layouts/DashboardLayout";

// hue 0-360
// sat 0-100%
// brightness 0-100%
// alpha
//color:hsla(0, 69%, 31%, 0.698);


interface PaletteGenValueControlProps {
    value: PaletteGenValue;
    onChange: (value: PaletteGenValue) => void;
    caption: string;
};

const PaletteGenValueControl = (props: PaletteGenValueControlProps) => {
    //console.log(`input val : ${props.value.offset01 * 100}`);
    const isLinked = false; //props.value.linkage !== "own";
    return <div className="controlRow">

        <div className="caption">pre-offset ({props.value.inpOffset01})</div>
        <input type="range" min="-80" max="80" step="0.1" value={props.value.inpOffset01 * 100} disabled={isLinked} onChange={(e) => {
            props.value.inpOffset01 = parseFloat(e.target.value) / 100;
            props.onChange(props.value);
        }}></input>

        <div className="caption">{props.caption} - offset ({props.value.offset01})</div>
        <input type="range" min="-100" max="100" step="0.1" value={props.value.offset01 * 100} disabled={isLinked} onChange={(e) => {
            props.value.offset01 = parseFloat(e.target.value) / 100;
            props.onChange(props.value);
        }}></input>

        <div className="caption">range ({props.value.range01})</div>
        <input type="range" min="-100" max="100" step="0.1" value={props.value.range01 * 100} disabled={isLinked} onChange={(e) => {
            props.value.range01 = parseFloat(e.target.value) / 100;
            props.onChange(props.value);
        }}></input>

        <div className="caption">{props.value.type}</div>
        <Radio
            size="small"
            checked={props.value.type === "fixed"}
            onChange={() => {
                props.value.type = "fixed";
                props.onChange(props.value);
            }}
        />
        <Radio
            size="small"
            checked={props.value.type === "distX"}
            onChange={() => {
                props.value.type = "distX";
                props.onChange(props.value);
            }}
        />
        <Radio
            size="small"
            checked={props.value.type === "distXInv"}
            onChange={() => {
                props.value.type = "distXInv";
                props.onChange(props.value);
            }}
        />
        <Radio
            size="small"
            checked={props.value.type === "distY"}
            onChange={() => {
                props.value.type = "distY";
                props.onChange(props.value);
            }}
        />
        <Radio
            size="small"
            checked={props.value.type === "distYInv"}
            onChange={() => {
                props.value.type = "distYInv";
                props.onChange(props.value);
            }}
        />
        <Radio
            size="small"
            checked={props.value.type === "stepX"}
            onChange={() => {
                props.value.type = "stepX";
                props.onChange(props.value);
            }}
        />
        <Radio
            size="small"
            checked={props.value.type === "stepY"}
            onChange={() => {
                props.value.type = "stepY";
                props.onChange(props.value);
            }}
        />
        <div className="caption">link mix {props.value.linkMix01}</div>
        <input type="range" min="0" max="100" step="0.01" value={props.value.linkMix01 * 100} disabled={isLinked} onChange={(e) => {
            props.value.linkMix01 = parseFloat(e.target.value) / 100;
            props.onChange(props.value);
        }}></input>

        <div className="caption">{props.value.linkage}</div>
        <Radio
            size="small"
            checked={props.value.linkage === "strong"}
            onChange={() => {
                props.value.linkage = "strong";
                props.onChange(props.value);
            }}
        />
        <Radio
            size="small"
            checked={props.value.linkage === "strongContrast"}
            onChange={() => {
                props.value.linkage = "strongContrast";
                props.onChange(props.value);
            }}
        />
        <Radio
            size="small"
            checked={props.value.linkage === "weak"}
            onChange={() => {
                props.value.linkage = "weak";
                props.onChange(props.value);
            }}
        />
    </div>;
};

interface PaletteGenControlGroupProps {
    caption: string;
    value: PaletteGenParamGroup;
    onChange: (value: PaletteGenParamGroup) => void;
};

const PaletteGenControlGroup = (props: PaletteGenControlGroupProps) => {
    return <div className="controlSection">
        <div className="caption">{props.caption}</div>
        <div className="controls">
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
        </div>{/* controls */}
    </div>;
};


interface PaletteGenControlsProps {
    value: PaletteGenParams;
    onChange: (value: PaletteGenParams) => void;
};

const PaletteGenControls = (props: PaletteGenControlsProps) => {
    return <div className="paletteGenRoot">
        <PaletteGenControlGroup caption="Strong (main)" value={props.value.strong}
            onChange={(v) => {
                props.value.strong = v;
                props.onChange(props.value);
            }}
        />
        <PaletteGenControlGroup caption="Strong contrast" value={props.value.strongContrast}
            onChange={(v) => {
                props.value.strongContrast = v;
                props.onChange(props.value);
            }}
        />
        <PaletteGenControlGroup caption="Weak" value={props.value.weak}
            onChange={(v) => {
                props.value.weak = v;
                props.onChange(props.value);
            }}
        />
        <PaletteGenControlGroup caption="Weak contrast" value={props.value.weakContrast}
            onChange={(v) => {
                props.value.weakContrast = v;
                props.onChange(props.value);
            }}
        />
    </div>;
};



const MyComponent = () => {
    const [dumdum, setDumDum] = React.useState(0);
    const [genParams, setGenParams] = React.useState<PaletteGenParams>(new PaletteGenParams());

    const palette = genParams.generatePalette();

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

    const numberOptions = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];

    const onCopy = async () => {
        const txt = JSON.stringify(genParams);
        await navigator.clipboard.writeText(txt);
        alert(`copied ${txt.length} chars`);
    };

    const onCopyPalette = async () => {
        const exp: ColorPaletteArgs = {
            entries: palette.entries,
            columns: palette.columns,
            defaultIndex: 0,
        }
        const txt = JSON.stringify(exp);
        await navigator.clipboard.writeText(txt);
        alert(`copied ${txt.length} chars`);
    };

    const onPaste = async () => {
        try {
            const txt = await navigator.clipboard.readText();
            const obj = JSON.parse(txt);
            const newParams = new PaletteGenParams(obj);
            setGenParams(newParams);
            setDumDum(dumdum + 1);
        } catch (e) {
            console.log(e);
            alert(`error; see log`);
        }
    };

    return <div className="paletteeditor">
        <Button onClick={onPaste}>Paste GEN from clipboard</Button>
        <Button onClick={onCopy}>Copy GEN to clipboard</Button>
        <Button onClick={onCopyPalette}>Copy PALETTE to clipboard</Button>
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

        <ColorPaletteGrid palette={palette} onClick={(e) => { }} showNull={true} showStrong={true} showWeak={true} />
    </div>;
};


const ColorSelTest = () => {
    const [sel, setSel] = React.useState<ColorPaletteEntry | null>(null);
    return <ColorPick allowNull={true} palettes={gGeneralPaletteList} value={sel} onChange={(e) => { setSel(e) }} />;
}

const ColorEditPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Instrument">
            <MyComponent></MyComponent>
            <ColorPaletteListComponent allowNull={true} palettes={gGeneralPaletteList} onClick={(v) => { }} />
            <ColorSelTest />
        </DashboardLayout>
    )
}

export default ColorEditPage;
