// todo
// split into:
// - SetlistPlannerComponents
// - break out all util components
// - break out setlist planner client utils into a lib

import { Button, DialogActions, DialogContent, Tooltip } from "@mui/material";
import React from "react";
import * as ReactSmoothDnd from "react-smooth-dnd";
import { ColorPaletteEntry, gGeneralPaletteList } from "shared/color";
import { ReactSmoothDndContainer, ReactSmoothDndDraggable } from "src/core/components/CMCoreComponents";
import { CMTextInputBase } from "src/core/components/CMTextField";
import { gIconMap } from "src/core/db3/components/IconMap";
import { SetlistPlan, SetlistPlanLedDef, SetlistPlanLedValue } from "src/core/db3/shared/setlistPlanTypes";
import { ColorPaletteListComponent, GetStyleVariablesForColor } from "../Color";
import { ReactiveInputDialog } from "../ReactiveInputDialog";
import { SetlistPlanMutator } from "./SetlistPlanUtilities";


//////////////////////////////////////////////////////////////////////////////////////////////////
interface SetlistPlannerLedProps {
    value: SetlistPlanLedValue | null;
    def: SetlistPlanLedDef;
    onChange: (newValue: SetlistPlanLedValue | null) => void;
}
export const SetlistPlannerLed = (props: SetlistPlannerLedProps) => {
    const [open, setOpen] = React.useState<boolean>(false);

    const style = GetStyleVariablesForColor({
        color: props.value?.color,
        enabled: true,
        fillOption: "filled",
        selected: false,
        variation: "strong",
    });
    return <>
        <Tooltip title={`${props.def.name}: ${props.value?.text || ""}`} disableInteractive>
            <div
                className={`applyColor interactable ${style.cssClass} setlistPlanLed`}
                onClick={() => setOpen(true)}
                style={{
                    ...style.style,
                    "--dim": "15px",
                    width: "var(--dim)",
                    height: "var(--dim)",
                } as any}
            >
                {(props.value?.text || "").substring(0, 1)}
            </div>
        </Tooltip>
        {open && (
            <ReactiveInputDialog onCancel={() => setOpen(false)}>
                <DialogContent>
                    <CMTextInputBase
                        value={props.value?.text || ""}
                        autoFocus={true}
                        onChange={(e) => props.onChange({
                            ledId: props.def.ledId,
                            ...props.value,
                            text: e.target.value
                        })}
                    />
                    <ColorPaletteListComponent allowNull={true} palettes={gGeneralPaletteList} onClick={(e: ColorPaletteEntry | null) => {
                        props.onChange({
                            ledId: props.def.ledId,
                            ...props.value,
                            color: e?.id || null
                        });
                    }} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpen(false)}>Close</Button>
                </DialogActions>
            </ReactiveInputDialog >
        )}
    </>;
};

//////////////////////////////////////////////////////////////////////////////////////////////////
interface SetlistPlannerLedArrayProps {
    //doc: SetlistPlan;
    //mutator: SetlistPlanMutator;
    ledDefs: SetlistPlanLedDef[];
    ledValues: SetlistPlanLedValue[];
    onLedValueChanged: (newValue: SetlistPlanLedValue) => void;
    direction: "row" | "column";
}
export const SetlistPlannerLedArray = (props: SetlistPlannerLedArrayProps) => {
    const rowLedValues = props.ledDefs
        .map((def) => {
            const val = props.ledValues.find((x) => x.ledId === def.ledId) || null;
            return {
                def,
                val,
            }
        });

    return <div className="setlistPlanLedArray" style={{ display: "flex", flexDirection: props.direction }}>
        {rowLedValues.map((item, index) => <SetlistPlannerLed
            key={index}
            value={item.val}
            def={item.def}
            onChange={props.onLedValueChanged}
        />)}
    </div>;
};


//////////////////////////////////////////////////////////////////////////////////////////////////
// led def editor
interface SetlistPlannerLedDefProps {
    ledDef: SetlistPlanLedDef;
    onChange: (newDef: SetlistPlanLedDef) => void;
    onDelete: (ledId: string) => void;
}
export const SetlistPlannerLedDef = (props: SetlistPlannerLedDefProps) => {
    //const [open, setOpen] = React.useState<boolean>(false);
    return <div className="setlistPlanLedDef" style={{ display: "flex", alignItems: "center" }}>
        <div className="dragHandle draggable" style={{ fontFamily: "monospace" }}>
            ☰
        </div>
        <CMTextInputBase
            value={props.ledDef.name}
            onChange={(e) => props.onChange({ ...props.ledDef, name: e.target.value })}
        />
        <Button onClick={() => props.onDelete(props.ledDef.ledId)}>{gIconMap.Delete()}</Button>
    </div>;
};

//////////////////////////////////////////////////////////////////////////////////////////////////
// led def array editor
interface SetlistPlannerLedDefArrayProps {
    doc: SetlistPlan;
    mutator: SetlistPlanMutator;
    collection: "row" | "column";
}

export const SetlistPlannerLedDefArray = (props: SetlistPlannerLedDefArrayProps) => {
    const ledDefs = (props.collection === "row" ? props.doc.payload.rowLeds : props.doc.payload.columnLeds) || [];

    const onDrop = (args: ReactSmoothDnd.DropResult) => {
        const proc = props.collection === "row" ? props.mutator.reorderRowLeds : props.mutator.reorderColumnLeds;
        proc(args);
    };

    return <div className="setlistPlanLedDefArray">
        <ReactSmoothDndContainer
            dragHandleSelector=".dragHandle"
            lockAxis="y"
            onDrop={onDrop}
        >

            {ledDefs.map((def, index) => <ReactSmoothDndDraggable key={index}>
                <SetlistPlannerLedDef
                    key={index}
                    ledDef={def}
                    onChange={(newDef) => {
                        const proc = props.collection === "row" ? props.mutator.updateRowLedDef : props.mutator.updateColumnLedDef;
                        proc(def.ledId, newDef);
                    }}
                    onDelete={(ledId) => {
                        const proc = props.collection === "row" ? props.mutator.deleteRowLedDef : props.mutator.deleteColumnLedDef;
                        proc(ledId);
                    }}
                />
            </ReactSmoothDndDraggable>)}

        </ReactSmoothDndContainer>

        <Button onClick={() => {
            const proc = props.collection === "row" ? props.mutator.addRowLedDef : props.mutator.addColumnLedDef;
            proc();
        }}>Add</Button>
    </div>;
};