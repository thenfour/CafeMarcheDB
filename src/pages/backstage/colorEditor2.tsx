
import { ColorBlenderParamsBundle } from "@/src/core/components/color/ColorBlender";
import { ColorBlender, FindClosestColorMatch, PaletteEntryEditor, SwatchTempPalette, UserPaletteGrid } from "@/src/core/components/color/ColorPageUtils";
import { ColorPaletteListComponent } from "@/src/core/components/color/ColorPaletteListComponent";
import { ColorPaletteEntry, ColorPaletteEntryVariation, gGeneralPaletteList } from "@/src/core/components/color/palette";
import { ParseColor, ParseTextPalette } from "@/src/core/components/color/TextPalette";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BlitzPage } from "@blitzjs/next";
import { Button } from "@mui/material";
import React from "react";
import { CMSinglePageSurfaceCard, OpenCloseIcon } from "src/core/components/CMCoreComponents";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { API } from "src/core/db3/clientAPI";

const MyComponent = () => {
    const textPaletteSetting = API.settings.useSetting("textPalette");
    const [textPalette, setTextPalette] = React.useState<string>(() => textPaletteSetting || "");
    const updateSettingToken = API.settings.updateSetting.useToken();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const [selectedEntryId, setSelectedEntryId] = React.useState<string | null>(null);
    const [forceRedraw, setForceRedraw] = React.useState<number>(0);

    const [showTempPalette, setShowTempPalette] = React.useState<boolean>(true);
    const [showBlender, setShowBlender] = React.useState<boolean>(false);
    const [showTextPalette, setShowTextPalette] = React.useState<boolean>(false);
    const [showColorEditor, setShowColorEditor] = React.useState<boolean>(true);

    const [paramBundleToSet, setParamBundleToSet] = React.useState<null | ColorBlenderParamsBundle>(null);
    const [paramBundleSerial, setParamBundleSerial] = React.useState<number>(0);

    const handleSave = () => {
        updateSettingToken.invoke({ name: "textPalette", value: textPalette }).then(x => {
            showSnackbar({ severity: "success", children: "Updated palette setting" });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "Error updating palette setting" });
        });
    };

    const handleSwatchClick = (p: ColorPaletteEntry | null) => {
        setSelectedEntryId(p?.id || null);
    };

    const selectedEntry = gGeneralPaletteList.findEntry(selectedEntryId);

    const parsedPalette = ParseTextPalette(textPalette);

    const handleEntryChanged = (e: ColorPaletteEntry) => {
        // replace the entry in the palette.
        const f = gGeneralPaletteList.findEntry(e.id);
        if (!f) return;
        Object.assign(f, e);
        setForceRedraw(forceRedraw + 1);
    };

    const handleCopyMap = async () => {
        const allEntries: ColorPaletteEntry[] = [];
        gGeneralPaletteList.palettes.forEach(p => allEntries.push(...p.entries));

        const code: string[] = allEntries.map(e => {
            const variationToArgs = (v: ColorPaletteEntryVariation) => {
                return `"${v.backgroundColor}", "${v.foregroundColor}", ${v.showBorder ? "true" : "false"}`
            }
            const variations = [
                e.strongDisabled,
                e.strongDisabledSelected,
                e.strong,
                e.strongSelected,
                e.weakDisabled,
                e.weakDisabledSelected,
                e.weak,
                e.weakSelected,
            ];
            return `CreatePaletteEntry("${e.id}", "${e.id}", "${e.contrastColorOnBlack}", "${e.contrastColorOnWhite}", ${variations.map(v => variationToArgs(v)).join(",")}),`
        });

        const txt = code.join(`\n`) + `\n`;
        await navigator.clipboard.writeText(txt);
        showSnackbar({ severity: "success", children: `copied ${txt.length} chars` });
    };

    // find entries which are not part of the text palette.
    let looseCount: number = 0;
    let looseEntries: ColorPaletteEntry[] = [];
    let alphaCount: number = 0;
    let alphaEntries: ColorPaletteEntry[] = [];
    let errorCount: number = 0;
    let errorEntries: ColorPaletteEntry[] = [];
    gGeneralPaletteList.palettes.forEach(p => p.entries.forEach(e => {
        let collectLoose = 0;
        let collectError = 0;
        let collectAlpha = 0;

        const localCheck = (c: string) => {
            if (!parsedPalette.allEntries.find(pp => pp.cssColor === c)) {
                collectLoose++;
            }
            const pS = ParseColor(c);
            if (pS.type !== "color") {
                collectError++;
            } else {
                if (pS.alpha01 < 1.0) {
                    collectAlpha++;
                }
            }
        };

        localCheck(e.contrastColorOnBlack);
        localCheck(e.contrastColorOnWhite);

        const localCheckVariation = (v: ColorPaletteEntryVariation) => {
            localCheck(v.foregroundColor);
            localCheck(v.backgroundColor);
        };

        localCheckVariation(e.strongDisabled);
        localCheckVariation(e.strongDisabledSelected);
        localCheckVariation(e.strong);
        localCheckVariation(e.strongSelected);
        localCheckVariation(e.weakDisabled);
        localCheckVariation(e.weakDisabledSelected);
        localCheckVariation(e.weak);
        localCheckVariation(e.weakSelected);

        looseCount += collectLoose;
        if (collectLoose) looseEntries.push(e);

        alphaCount += collectAlpha;
        if (collectAlpha) alphaEntries.push(e);

        errorCount += collectError;
        if (collectError) errorEntries.push(e);

    }));

    const handleMatchAllColors = () => {

        gGeneralPaletteList.palettes.forEach(p => p.entries.forEach(e => {

            const localDoVariation = (v: ColorPaletteEntryVariation) => {
                const mS = FindClosestColorMatch({ parsedPalette, value: v.backgroundColor });
                if (!mS) return;
                v.backgroundColor = mS.cssColor;
                const mSC = FindClosestColorMatch({ parsedPalette, value: v.foregroundColor });
                if (!mSC) return;
                v.foregroundColor = mSC.cssColor;
            };

            const cob = FindClosestColorMatch({ parsedPalette, value: e.contrastColorOnBlack });
            if (!cob) return;
            e.contrastColorOnBlack = cob.cssColor;

            const cow = FindClosestColorMatch({ parsedPalette, value: e.contrastColorOnWhite });
            if (!cow) return;
            e.contrastColorOnWhite = cow.cssColor;

            localDoVariation(e.strongDisabled);
            localDoVariation(e.strongDisabledSelected);
            localDoVariation(e.strong);
            localDoVariation(e.strongSelected);
            localDoVariation(e.weakDisabled);
            localDoVariation(e.weakDisabledSelected);
            localDoVariation(e.weak);
            localDoVariation(e.weakSelected);
        }));

        showSnackbar({ severity: "success", children: "Palette updated." });
    };

    return <div className="paletteeditor2">
        {/* <div><a href="https://colordesigner.io/">tool for generating tones / tints / shades of a primary</a></div> */}

        <CMSinglePageSurfaceCard className="SwatchTempPaletteSection">
            <div className="header interactable" onClick={() => setShowTempPalette(!showTempPalette)}>
                <OpenCloseIcon isOpen={showTempPalette} /> Temp Palette
            </div>
            {showTempPalette && <div className="content">
                <SwatchTempPalette
                    onSetBlenderParamBundle={(pb) => {
                        setParamBundleToSet(pb);
                        setParamBundleSerial(paramBundleSerial + 1);
                        setShowBlender(true)
                    }}
                />
            </div>}
        </CMSinglePageSurfaceCard>

        <CMSinglePageSurfaceCard>
            <div className="header interactable" onClick={() => setShowBlender(!showBlender)}>
                <OpenCloseIcon isOpen={showBlender} /> Color blender tool
            </div>
            {showBlender && <div className="content">
                <ColorBlender handleAppendToTextPalette={(txt) => setTextPalette(textPalette + txt)} setParamBundle={paramBundleToSet} setParamBundleSerial={paramBundleSerial} />
            </div>}
        </CMSinglePageSurfaceCard>

        <CMSinglePageSurfaceCard>
            <div className="header interactable" onClick={() => setShowTextPalette(!showTextPalette)}>
                <OpenCloseIcon isOpen={showTextPalette} /> Text palette {parsedPalette.allEntries.length}
            </div>
            {showTextPalette && <div className="content">
                <div className="textPaletteLayout">
                    <textarea value={textPalette || ""} onChange={e => setTextPalette(e.target.value)}></textarea>
                    <UserPaletteGrid
                        parsedPalette={parsedPalette}
                        selectedEntries={[]}
                        onSetBlenderParamBundle={(pb) => {
                            setParamBundleToSet(pb);
                            setParamBundleSerial(paramBundleSerial + 1);
                            setShowBlender(true)
                        }}
                    />
                </div>
                <button onClick={handleSave} disabled={textPalette === textPaletteSetting} >Save to settings</button>
            </div>}
        </CMSinglePageSurfaceCard>

        <CMSinglePageSurfaceCard>
            <div className="header interactable" onClick={() => setShowColorEditor(!showColorEditor)}>
                <OpenCloseIcon isOpen={showColorEditor} /> Edit color
            </div>
            {showColorEditor && <div className="content">

                <div>
                    <Button onClick={handleCopyMap}>copy map</Button>
                    search for `const gPaletteMap` and paste this to set this as your palette.
                </div>

                {selectedEntry && <PaletteEntryEditor onClose={() => setSelectedEntryId(null)} value={selectedEntry} onChange={handleEntryChanged} parsedPalette={parsedPalette} />}

                <ColorPaletteListComponent
                    allowNull={false}
                    showHiddenSwatches={true}
                    selectedColor={selectedEntryId}

                    onClick={handleSwatchClick} onDrop={(dropped, target) => {
                        // copy all variations for this color.
                        const e = gGeneralPaletteList.findEntry(target.id)!;
                        e.contrastColorOnBlack = dropped.contrastColorOnBlack;
                        e.contrastColorOnWhite = dropped.contrastColorOnWhite;

                        e.strong = { ...dropped.strong };
                        e.strongDisabled = { ...dropped.strongDisabled };
                        e.strongDisabledSelected = { ...dropped.strongDisabledSelected };
                        e.strongSelected = { ...dropped.strongSelected };

                        e.weak = { ...dropped.weak };
                        e.weakDisabled = { ...dropped.weakDisabled };
                        e.weakDisabledSelected = { ...dropped.weakDisabledSelected };
                        e.weakSelected = { ...dropped.weakSelected };
                        setForceRedraw(forceRedraw + 1);
                    }}
                />

                <div className={`looseColorsInfoContainer ${looseCount > 0 && "alert"}`}>
                    {looseCount} colors were found that don't have a match in your specified text palette. note: this does not work well when colors contain alpha values.
                    <Button onClick={handleMatchAllColors}>correct all {looseCount} entries</Button>
                    <div className="looseEntryList">
                        {looseEntries.map(e => <div className="looseEntry" key={e.id}>{e.label}</div>)}
                    </div>
                </div>

                <div className={`alphaColorsInfoContainer ${alphaCount > 0 && "alert"}`}>
                    {alphaCount} colors were found that have alpha; it's not going to work well in some cases. maybe it's ok?
                    {/* <Button onClick={removeAlphaAllColors}>remove alpha from all {alphaCount} entries</Button> */}
                    <div className="looseEntryList">
                        {alphaEntries.map(e => <div className="looseEntry" key={e.id}>{e.label}</div>)}
                    </div>
                </div>

                <div className={`alphaColorsInfoContainer ${errorCount > 0 && "alert"}`}>
                    {errorCount} colors failed to parse. hm?
                    <div className="looseEntryList">
                        {errorEntries.map(e => <div className="looseEntry" key={e.id}>{e.label}</div>)}
                    </div>
                </div>

            </div>}
        </CMSinglePageSurfaceCard>

    </div>;
};

const ColorEdit2Page: BlitzPage = () => {
    return (
        <DashboardLayout title="theme editor">
            <MyComponent></MyComponent>
        </DashboardLayout>
    )
}

export default ColorEdit2Page;

