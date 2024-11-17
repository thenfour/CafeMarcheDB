import { WorkflowDef, WorkflowFieldValueOperator, WorkflowNodeDef, WorkflowTidiedNodeInstance } from "shared/workflowEngine";
import { EvaluatedWorkflowContext, FieldComponentProps, WFFieldBinding } from "./WorkflowUserComponents";
import { Button, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import React, { useContext } from "react";
import { CMMultiSelect, CMSelectDisplayStyle, CMSingleSelect } from "./CMSelect";
import { useDashboardContext } from "./DashboardContext";
import { z } from "zod";
import { ReactiveInputDialog } from "./ReactiveInputDialog";

type TPK = number | null | undefined;

/////////////////////////////////////////////////////////////////////////////////////////////
export const DB3ForeignSingleBindingValueComponent = (props: FieldComponentProps<TPK>) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);
    const [open, setOpen] = React.useState<boolean>(false);
    const [value, setValue] = React.useState<TPK>(props.binding.value);

    return <>
        <Button onClick={() => setOpen(true)}>Edit</Button>
        {open && <ReactiveInputDialog onCancel={() => setOpen(false)}>
            <DialogTitle>
                {props.binding.fieldNameForDisplay}
            </DialogTitle>
            <DialogContent dividers>
                ...
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => {
                    props.binding.setValue(value);
                    setOpen(false);
                }}>OK</Button>
            </DialogActions>
        </ReactiveInputDialog>}
    </>;
}


/////////////////////////////////////////////////////////////////////////////////////////////
export const EventTypeBindingOperand2Component = (props: FieldComponentProps<TPK>) => {
    const dashboardContext = useDashboardContext();
    const toPkArray = (x: any): TPK[] => {
        const schema = z.array(z.number());
        const parsed = schema.safeParse(x);
        if (!parsed.success) return [];
        return parsed.data;
    };
    const val = toPkArray(props.binding.nodeDef.fieldValueOperand2);
    return <CMMultiSelect<TPK>
        displayStyle={CMSelectDisplayStyle.SelectedWithDialog}
        readonly={props.readonly}
        chipShape={"rectangle"}
        chipSize={"small"}
        onChange={v => {
            console.log(`setting operand2`);
            props.binding.setOperand2(v);
        }}
        value={val}

        getOptions={(args) => dashboardContext.eventStatus.items.map(e => e.id)}
        renderOption={opt => (opt && (dashboardContext.eventStatus.getById(opt)?.label)) || "<none>"}
        getOptionInfo={opt => {
            const x = dashboardContext.eventStatus.getById(opt);
            if (!x) return {
                id: -1,
            }
            return {
                id: x.id,
                tooltip: x.description,
                color: x.color,
            };
        }}
    />;
}





/////////////////////////////////////////////////////////////////////////////////////////////
// assume you will be looking up the values based on pk, not returning full objects.
export const MakeDB3ForeignSingleBinding = (args: {
    flowDef: WorkflowDef,
    nodeDef: WorkflowNodeDef,
    tidiedNodeInstance: WorkflowTidiedNodeInstance,
    fieldNameForDisplay: string,
    value: TPK,
    setValue?: (val: TPK) => void,
    setOperand2?: (val: (TPK) | (TPK)[]) => void,
    FieldValueComponent: React.ComponentType<FieldComponentProps<TPK>>,
    FieldOperand2Component: React.ComponentType<FieldComponentProps<TPK>>,
}
): WFFieldBinding<TPK> => {
    return {
        flowDef: args.flowDef,
        nodeDef: args.nodeDef,
        tidiedNodeInstance: args.tidiedNodeInstance,
        fieldNameForDisplay: args.fieldNameForDisplay,
        value: args.value,
        valueAsString: JSON.stringify(args.value),
        setValue: args.setValue || (() => { }),
        setOperand2: args.setOperand2 || (() => console.log(`setoperand2 needs to eventually be connected to workflowdef mutation.`)),
        doesFieldValueSatisfyCompletionCriteria: () => {
            if (!args.nodeDef.fieldValueOperator) {
                return false;
            }
            const lhs = args.value;
            const rhs = args.nodeDef.fieldValueOperand2;

            switch (args.nodeDef.fieldValueOperator) {
                case WorkflowFieldValueOperator.Falsy:
                case WorkflowFieldValueOperator.IsNull:
                    return !lhs;
                case WorkflowFieldValueOperator.Truthy:
                case WorkflowFieldValueOperator.StringPopulated:
                case WorkflowFieldValueOperator.IsNotNull:
                    return !!lhs;
                case WorkflowFieldValueOperator.EqualsOperand2:
                    return lhs === rhs;
                case WorkflowFieldValueOperator.NotEqualsOperand2:
                    return lhs !== rhs;
                case WorkflowFieldValueOperator.EqualsAnyOf:
                    if (Array.isArray(rhs)) return false;
                    if (!Array.isArray(args.nodeDef.fieldValueOperand2)) return false;
                    return (args.nodeDef.fieldValueOperand2 as any[]).includes(lhs);
                case WorkflowFieldValueOperator.IsNotAnyOf:
                    if (Array.isArray(rhs)) return true;
                    if (!Array.isArray(args.nodeDef.fieldValueOperand2)) return false;
                    return !(args.nodeDef.fieldValueOperand2 as any[]).includes(lhs);
                default:
                    console.warn(`unknown FSV field operator ${args.nodeDef.fieldValueOperator}`);
                    return false;
            }
        },
        FieldValueComponent: args.FieldValueComponent,// (props) => <DB3ForeignSingleBindingValueComponent {...props} />,
        FieldOperand2Component: args.FieldOperand2Component,// (props) => <DB3ForeignSingleBindingOperand2Component {...props} />,
    };
};


