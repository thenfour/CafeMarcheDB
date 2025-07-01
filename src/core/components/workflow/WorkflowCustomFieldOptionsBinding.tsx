import React, { useContext } from "react";
import { assertUnreachable, IsNullOrWhitespace } from "shared/utils";
import { WorkflowDef, WorkflowFieldValueOperator, WorkflowNodeDef, WorkflowTidiedNodeInstance } from "shared/workflowEngine";
import * as db3 from "src/core/db3/db3";
import { z } from "zod";
import { CMSmallButton } from "../CMCoreComponents2";
import { CMMultiSelect, CMSelectDisplayStyle, CMSingleSelect } from "../select/CMSelect";
import { CMSelectNullBehavior } from "../select/CMSingleSelectDialog";
import { EvaluatedWorkflowContext, FieldComponentProps, WFFieldBinding } from "./WorkflowUserComponents";
import { arraysContainSameValues } from "shared/arrayUtils";

type TPK = string;

const valueToStringArray = (incomingValue: any) => {
    const schema = z.array(z.string());
    const val = schema.safeParse(incomingValue);
    if (val.success) {
        return val.data;
    }
    return [];
};

const incomingValueToString = (incomingValue: any) => {
    const schema = z.string();
    const val = schema.safeParse(incomingValue);
    if (val.success) {
        return val.data;
    }
    return null;
};

type OptionsProps = {
    options: db3.EventCustomFieldOptions;
}

/////////////////////////////////////////////////////////////////////////////////////////////
export const EventCustomFieldOptionsBindingValueComponent = (props: FieldComponentProps<TPK | null> & OptionsProps) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);
    //const dashboardContext = useDashboardContext();

    return <CMSingleSelect<TPK>
        nullBehavior={CMSelectNullBehavior.AllowNull}
        displayStyle={CMSelectDisplayStyle.CustomButtonWithDialog}
        value={incomingValueToString(props.binding.value)}
        getOptions={(args) => props.options.map(x => x.id)}
        getOptionInfo={(id) => {
            const x = props.options.find(x => x.id === id);
            if (!x) return {
                id: -1,
                color: null,
                tooltip: undefined,
            };
            return {
                id: x.id,
                color: x.color,
            };
        }}
        onChange={(option) => props.binding.setValue(option)}
        renderOption={(id) => {
            if (IsNullOrWhitespace(id)) {
                return "--";
            }
            const x = props.options.find(x => x.id === id);
            if (!x) {
                return "--";
            }
            return x.label;
        }}
        customRender={(onClick) => <CMSmallButton onClick={onClick}>select</CMSmallButton>}
    />;
}


/////////////////////////////////////////////////////////////////////////////////////////////
export const EventCustomFieldOptionsBindingOperand2Component = (props: FieldComponentProps<TPK> & OptionsProps) => {
    const val = valueToStringArray(props.binding.nodeDef.fieldValueOperand2);
    return <CMMultiSelect<TPK>
        displayStyle={CMSelectDisplayStyle.SelectedWithDialog}
        readonly={props.readonly}
        chipShape={"rectangle"}
        chipSize={"small"}
        onChange={v => {
            props.binding.setOperand2(v);
        }}
        value={val}
        getOptions={(args) => props.options.map(x => x.id)}
        renderOption={(id) => {
            if (IsNullOrWhitespace(id)) {
                return "--";
            }
            const x = props.options.find(x => x.id === id);
            if (!x) {
                return "--";
            }
            return x.label;
        }}
        getOptionInfo={id => {
            const x = props.options.find(x => x.id === id);
            if (!x) return {
                id: -1,
            }
            return {
                id: x.id,
                color: x.color,
            };
        }}
    />;
}







/////////////////////////////////////////////////////////////////////////////////////////////
// assume you will be looking up the values based on pk, not returning full objects.
export const MakeCustomFieldOptionsBinding = (args: {
    flowDef: WorkflowDef,
    nodeDef: WorkflowNodeDef,
    tidiedNodeInstance: WorkflowTidiedNodeInstance,
    fieldNameForDisplay: string,
    value: TPK,
    setValue?: (val: TPK) => void,
    setOperand2?: (val: TPK[]) => void,
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
        setOperand2: args.setOperand2 || (() => {
            console.log(`setoperand2 needs to eventually be connected to workflowdef mutation.`);
        }),
        doesFieldValueSatisfyCompletionCriteria: () => {
            if (!args.nodeDef.fieldValueOperator) {
                return false;
            }
            const lhs: TPK = args.value;
            const rhs = valueToStringArray(args.nodeDef.fieldValueOperand2);
            switch (args.nodeDef.fieldValueOperator) {
                case WorkflowFieldValueOperator.StringMatchesPattern:
                    return false;
                case WorkflowFieldValueOperator.Falsy:
                case WorkflowFieldValueOperator.IsNull:
                    return !lhs;
                case WorkflowFieldValueOperator.Truthy:
                case WorkflowFieldValueOperator.StringPopulated:
                case WorkflowFieldValueOperator.IsNotNull:
                    return !!lhs;
                case WorkflowFieldValueOperator.ContainsAllValues:
                case WorkflowFieldValueOperator.HasOnlyAllowedValues:
                case WorkflowFieldValueOperator.EqualsOperand2:
                    return arraysContainSameValues([lhs], rhs);
                case WorkflowFieldValueOperator.NotEqualsOperand2:
                    return !arraysContainSameValues([lhs], rhs);
                case WorkflowFieldValueOperator.EqualsAnyOf:
                    return (rhs as any[]).includes(lhs);
                case WorkflowFieldValueOperator.IsNotAnyOf:
                    return !(rhs as any[]).includes(lhs);
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


