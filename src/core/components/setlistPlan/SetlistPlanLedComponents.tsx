// todo
// split into:
// - SetlistPlannerComponents
// - break out all util components
// - break out setlist planner client utils into a lib

import { Button, DialogContent, Tooltip } from "@mui/material";
import React from "react";
import * as ReactSmoothDnd from "react-smooth-dnd";
import { QuickSearchItemTypeSets } from "shared/quickFilter";
import { ReactSmoothDndContainer, ReactSmoothDndDraggable } from "src/core/components/CMCoreComponents";
import { CMTextInputBase } from "src/core/components/CMTextField";
import { gIconMap } from "src/core/db3/components/IconMap";
import { GetUserAttendanceRet } from "src/core/db3/shared/apiTypes";
import { SetlistPlan, SetlistPlanAssociatedItem, SetlistPlanLedDef, SetlistPlanLedValue } from "src/core/db3/shared/setlistPlanTypes";
import { DialogActionsCM, NameValuePair } from "../CMCoreComponents2";
import { useDashboardContext } from "../DashboardContext";
import { AssociationSelect, AssociationValueLink } from "../ItemAssociation";
import { Markdown } from "../markdown/Markdown";
import { Markdown3Editor } from "../markdown/MarkdownControl3";
import { ReactiveInputDialog } from "../ReactiveInputDialog";
import { SetlistPlanMutator } from "./SetlistPlanUtilities";
import { ColorPick } from "../color/ColorPick";
import { GetStyleVariablesForColor } from "../color/ColorClientUtils";
import { AttendanceChip } from "../event/AttendanceChips";
//import getUserEventAttendance from "src/core/db3/queries/getUserEventAttendance";


//////////////////////////////////////////////////////////////////////////////////////////////////
interface SetlistPlannerLedProps {
    value: SetlistPlanLedValue | null;
    def: SetlistPlanLedDef;
    onChange: (newValue: SetlistPlanLedValue | null) => void;
    additionalAssociatedItems: SetlistPlanAssociatedItem[]; // for auto color, pass associated item for the column / row / whatever.
}
export const SetlistPlannerLed = (props: SetlistPlannerLedProps) => {
    const [open, setOpen] = React.useState<boolean>(false);
    const [actualColor, setActualColor] = React.useState<string | null>(props.value?.color || null);
    const [userAttendance, setUserAttendance] = React.useState<GetUserAttendanceRet | null>(null);
    const dashboardContext = useDashboardContext();

    React.useEffect(() => {
        // unify list of associations.
        const associations = [props.def.associatedItem, ...props.additionalAssociatedItems];
        // if there are event <--> user associations, use the attendance color.
        // so first find an eventId and a userId.
        const eventId = associations.find((x) => x?.itemType === "event")?.id;
        const userId = associations.find((x) => x?.itemType === "user")?.id;
        if (props.def.autoColor && eventId && userId) {
            void fetch(`/api/event/getUserAttendance?userId=${userId}&eventId=${eventId}`)
                .then((res) => res.json())
                .then((data: GetUserAttendanceRet) => {
                    setUserAttendance(data);
                    // event ID has been specified, but what if there are multiple segments?
                    // use the first one.
                    const response = data.segmentResponses[0];
                    const attendance = dashboardContext.eventAttendance.getById(response?.attendanceId);
                    if (attendance) {
                        setActualColor(attendance.color);
                    }
                })
        } else {
            setActualColor(props.value?.color || null);
        }
    },
        [props.def.autoColor, JSON.stringify(props.def.associatedItem), JSON.stringify(props.additionalAssociatedItems), props.value?.color]);

    const style = GetStyleVariablesForColor({
        color: actualColor,
        enabled: true,
        fillOption: "filled",
        selected: false,
        variation: "strong",
    });
    return <>
        <Tooltip title={
            <div>
                <div>{props.def.name}: {props.value?.text || ""}</div>
                {props.def.associatedItem && <AssociationValueLink value={{ ...props.def.associatedItem, matchingField: undefined, matchStrength: 0 }} />}
                {userAttendance && <ul>
                    {userAttendance.segmentResponses.map((x, i) => <li key={i}>
                        {x.name}: <AttendanceChip value={x.attendanceId} />
                    </li>)}
                </ul>}
                <Markdown markdown={props.def.descriptionMarkdown || ""} />
            </div>}
            disableInteractive
        >
            <div
                className={`applyColor interactable ${style.cssClass} setlistPlanLed`}
                onClick={() => setOpen(true)}
                style={{
                    ...style.style,
                    "--dim": "15px",
                    minWidth: "var(--dim)",
                    height: "var(--dim)",
                } as any}
            >
                {`${props.def.staticLabel || ""}${props.value?.text || ""}`}
            </div>
        </Tooltip>
        {open && (
            <ReactiveInputDialog onCancel={() => setOpen(false)}>
                <DialogContent>
                    <CMTextInputBase
                        value={props.value?.text || ""}
                        //autoFocus={true}
                        onChange={(e) => props.onChange({
                            ledId: props.def.ledId,
                            ...props.value,
                            text: e.target.value
                        })}
                    />
                    <ColorPick
                        value={props.value?.color || null}
                        allowNull={true}
                        onChange={(newColor) => {
                            props.onChange({
                                ledId: props.def.ledId,
                                ...props.value,
                                color: newColor?.id || null
                            });
                        }}
                    />
                    <DialogActionsCM>
                        <Button onClick={() => setOpen(false)}>Close</Button>
                    </DialogActionsCM>
                </DialogContent>
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
    additionalAssociatedItems: SetlistPlanAssociatedItem[];
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
            additionalAssociatedItems={props.additionalAssociatedItems}
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
    return <div className="SetlistPlannerDocumentEditorSegment setlistPlanLedDef">
        <div className="dragHandle draggable" style={{ fontFamily: "monospace" }}>
            ☰
        </div>
        <NameValuePair name="Name" value={
            <CMTextInputBase
                value={props.ledDef.name}
                onChange={(e) => props.onChange({ ...props.ledDef, name: e.target.value })}
            />} />
        <NameValuePair name="Static label" value={
            <CMTextInputBase
                value={props.ledDef.staticLabel || ""}
                onChange={(e) => props.onChange({ ...props.ledDef, staticLabel: e.target.value })}
            />
        } />
        <NameValuePair name="Description" value={
            <Markdown3Editor
                onChange={(newValue) => props.onChange({ ...props.ledDef, descriptionMarkdown: newValue })}
                value={props.ledDef.descriptionMarkdown || ""}
                nominalHeight={75}
            />
        } />
        <AssociationSelect
            allowedItemTypes={QuickSearchItemTypeSets.Everything!}
            value={!props.ledDef.associatedItem ? null : { ...props.ledDef.associatedItem, matchStrength: 0, matchingField: undefined }}
            onChange={(newValue) => props.onChange({ ...props.ledDef, associatedItem: newValue })}
        />
        <NameValuePair name="Auto color" description={`colors based on associated item. user + event = attendance for example.`} value={
            <input
                type="checkbox"
                checked={props.ledDef.autoColor || false}
                onChange={(e) => props.onChange({ ...props.ledDef, autoColor: e.target.checked })}
            />
        } />
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
        if (args.addedIndex === args.removedIndex) return; // no change
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