import React, { useContext } from "react";
import { assertUnreachable } from "shared/utils";
import { WorkflowDef, WorkflowFieldValueOperator, WorkflowNodeDef, WorkflowTidiedNodeInstance } from "shared/workflowEngine";
import { z } from "zod";
import { CMSmallButton } from "./CMCoreComponents2";
import { CMMultiSelect, CMSelectDisplayStyle } from "./CMSelect";
import { useDashboardContext } from "./DashboardContext";
import { EvaluatedWorkflowContext, FieldComponentProps, WFFieldBinding } from "./WorkflowUserComponents";
import { arraysContainSameValues } from "shared/arrayUtils";


type TPK = number;


const valueToNumberArray = (incomingValue: any) => {
    const schema = z.array(z.number());
    const val = schema.safeParse(incomingValue);
    if (val.success) {
        return val.data;
    }
    return [];
};



/////////////////////////////////////////////////////////////////////////////////////////////
export const EventTagsBindingValueComponent = (props: FieldComponentProps<TPK[]>) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);
    const dashboardContext = useDashboardContext();

    return <CMMultiSelect
        displayStyle={CMSelectDisplayStyle.CustomButtonWithDialog}
        value={valueToNumberArray(props.binding.value)}
        getOptions={(args) => dashboardContext.eventTag.items.map(x => x.id)}
        getOptionInfo={(id) => {
            const x = dashboardContext.eventTag.getById(id);
            if (!x) return {
                id: -1,
                color: null,
                tooltip: undefined,
            };
            return {
                id: x.id,
                color: x.color,
                tooltip: x.description,
            };
        }}
        onChange={(option) => props.binding.setValue(option)}
        renderOption={(id) => {
            if (!id || id < 0) {
                return "--";
            }
            const x = dashboardContext.eventTag.getById(id)!;
            return x.text;
        }}
        customRender={(onClick) => <CMSmallButton onClick={onClick}>select</CMSmallButton>}
    />;
}


/////////////////////////////////////////////////////////////////////////////////////////////
export const EventTagsBindingOperand2Component = (props: FieldComponentProps<TPK[]>) => {
    const dashboardContext = useDashboardContext();
    const val = valueToNumberArray(props.binding.nodeDef.fieldValueOperand2);
    return <CMMultiSelect<TPK>
        displayStyle={CMSelectDisplayStyle.SelectedWithDialog}
        readonly={props.readonly}
        chipShape={"rectangle"}
        chipSize={"small"}
        onChange={v => {
            props.binding.setOperand2(v);
        }}
        value={val}

        getOptions={(args) => dashboardContext.eventTag.items.map(e => e.id)}
        renderOption={opt => (opt && (dashboardContext.eventTag.getById(opt)?.text)) || "<none>"}
        getOptionInfo={opt => {
            const x = dashboardContext.eventTag.getById(opt);
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
export const MakeDB3TagsBinding = (args: {
    flowDef: WorkflowDef,
    nodeDef: WorkflowNodeDef,
    tidiedNodeInstance: WorkflowTidiedNodeInstance,
    fieldNameForDisplay: string,
    value: TPK[],
    setValue?: (val: TPK[]) => void,
    setOperand2?: (val: TPK[]) => void,
    FieldValueComponent: React.ComponentType<FieldComponentProps<TPK[]>>,
    FieldOperand2Component: React.ComponentType<FieldComponentProps<TPK[]>>,
}
): WFFieldBinding<TPK[]> => {
    return {
        flowDef: args.flowDef,
        nodeDef: args.nodeDef,
        tidiedNodeInstance: args.tidiedNodeInstance,
        fieldNameForDisplay: args.fieldNameForDisplay,
        value: args.value,
        valueAsString: JSON.stringify(args.value),
        setValue: args.setValue || (() => { }),
        setOperand2: args.setOperand2 || (() => {
            console.log(`setoperand2 needs to eventually be connected to workflowdef mutation.`);
        }),
        doesFieldValueSatisfyCompletionCriteria: () => {
            if (!args.nodeDef.fieldValueOperator) {
                return false;
            }
            const lhs: TPK[] = args.value;
            const rhs: TPK[] = valueToNumberArray(args.nodeDef.fieldValueOperand2);
            switch (args.nodeDef.fieldValueOperator) {
                case WorkflowFieldValueOperator.Falsy:
                case WorkflowFieldValueOperator.IsNull:
                    return lhs.length < 1;
                case WorkflowFieldValueOperator.Truthy:
                case WorkflowFieldValueOperator.StringPopulated:
                case WorkflowFieldValueOperator.IsNotNull:
                    return lhs.length > 0;
                // MAIN set operators
                case WorkflowFieldValueOperator.NotEqualsOperand2: // doesn't equal... this is not so useful maybe?
                    return !arraysContainSameValues(lhs, rhs);
                case WorkflowFieldValueOperator.EqualsOperand2: // EQUALITY == exactly
                    return arraysContainSameValues(lhs, rhs);
                case WorkflowFieldValueOperator.EqualsAnyOf: // i think this would be Intersection Non-Empty ?
                    return lhs.some((value) => rhs.includes(value));
                case WorkflowFieldValueOperator.IsNotAnyOf: // aka "does not intersect" - disjoint?
                    return !lhs.some((value) => rhs.includes(value));
                case WorkflowFieldValueOperator.HasOnlyAllowedValues: // SUBSET
                    return lhs.every((value) => rhs.includes(value)); // rhs are the only allowed values in the model
                case WorkflowFieldValueOperator.ContainsAllValues: // SUPERSET
                    return rhs.every((value) => lhs.includes(value)); // contains ALL of
                case WorkflowFieldValueOperator.StringMatchesPattern:
                    return false;
                default:
                    assertUnreachable(args.nodeDef.fieldValueOperator);
                    console.warn(`unknown FSV field operator ${args.nodeDef.fieldValueOperator}`);
                    return false;
            }
        },
        FieldValueComponent: args.FieldValueComponent,
        FieldOperand2Component: args.FieldOperand2Component,
    };
};


