import React, { useContext } from "react";
import { WorkflowDef, WorkflowFieldValueOperator, WorkflowNodeDef, WorkflowTidiedNodeInstance } from "shared/workflowEngine";
import { z } from "zod";
import { CMSmallButton } from "./CMCoreComponents2";
import { CMMultiSelect, CMSelectDisplayStyle, CMSingleSelect } from "./CMSelect";
import { useDashboardContext } from "./DashboardContext";
import { EvaluatedWorkflowContext, FieldComponentProps, WFFieldBinding } from "./WorkflowUserComponents";
import { arraysContainSameValues, assertUnreachable } from "shared/utils";

type TPK = number | null | undefined;

const incomingValueToNumber = (incomingValue: any) => {
    const schema = z.number();
    const val = schema.safeParse(incomingValue);
    if (val.success) {
        return val.data;
    }
    return null;
};

const toPkArray = (x: any): TPK[] => {
    const schema = z.array(z.number());
    const parsed = schema.safeParse(x);
    if (!parsed.success) return [];
    return parsed.data;
};


/////////////////////////////////////////////////////////////////////////////////////////////
export const EventTypeBindingValueComponent = (props: FieldComponentProps<TPK>) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);
    const dashboardContext = useDashboardContext();

    return <CMSingleSelect
        displayStyle={CMSelectDisplayStyle.CustomButtonWithDialog}
        value={incomingValueToNumber(props.binding.value)}
        getOptions={(args) => dashboardContext.eventType.items.map(x => x.id)}
        getOptionInfo={(id) => {
            const x = dashboardContext.eventType.getById(id);
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
            const x = dashboardContext.eventType.getById(id)!;
            return x.text;
        }}
        customRender={(onClick) => <CMSmallButton onClick={onClick}>select</CMSmallButton>}
    />;
}


/////////////////////////////////////////////////////////////////////////////////////////////
export const EventTypeBindingOperand2Component = (props: FieldComponentProps<TPK>) => {
    const dashboardContext = useDashboardContext();
    const val = toPkArray(props.binding.nodeDef.fieldValueOperand2);
    return <CMMultiSelect<TPK>
        displayStyle={CMSelectDisplayStyle.SelectedWithDialog}
        readonly={props.readonly}
        chipShape={"rectangle"}
        chipSize={"small"}
        onChange={v => {
            props.binding.setOperand2(v);
        }}
        value={val}

        getOptions={(args) => dashboardContext.eventType.items.map(e => e.id)}
        renderOption={opt => (opt && (dashboardContext.eventType.getById(opt)?.text)) || "<none>"}
        getOptionInfo={opt => {
            const x = dashboardContext.eventType.getById(opt);
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
export const EventStatusBindingValueComponent = (props: FieldComponentProps<TPK>) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);
    const dashboardContext = useDashboardContext();

    return <CMSingleSelect
        displayStyle={CMSelectDisplayStyle.CustomButtonWithDialog}
        chipShape="rectangle"
        value={incomingValueToNumber(props.binding.value)}
        getOptions={(args) => dashboardContext.eventStatus.items.map(x => x.id)}
        getOptionInfo={(id) => {
            const x = dashboardContext.eventStatus.getById(id);
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
            const x = dashboardContext.eventStatus.getById(id)!;
            return x.label;
        }}
        customRender={(onClick) => <CMSmallButton onClick={onClick}>select</CMSmallButton>}
    />;
}


/////////////////////////////////////////////////////////////////////////////////////////////
export const EventStatusBindingOperand2Component = (props: FieldComponentProps<TPK>) => {
    const dashboardContext = useDashboardContext();
    const val = toPkArray(props.binding.nodeDef.fieldValueOperand2);
    return <CMMultiSelect<TPK>
        displayStyle={CMSelectDisplayStyle.SelectedWithDialog}
        readonly={props.readonly}
        chipShape={"rectangle"}
        chipSize={"small"}
        onChange={v => {
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
export const UserTagIdBindingValueComponent = (props: FieldComponentProps<TPK>) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);
    const dashboardContext = useDashboardContext();

    return <CMSingleSelect
        displayStyle={CMSelectDisplayStyle.CustomButtonWithDialog}
        chipShape="rounded"
        value={incomingValueToNumber(props.binding.value)}
        getOptions={(args) => dashboardContext.userTag.items.map(x => x.id)}
        getOptionInfo={(id) => {
            const x = dashboardContext.userTag.getById(id);
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
            const x = dashboardContext.userTag.getById(id)!;
            return x.text;
        }}
        customRender={(onClick) => <CMSmallButton onClick={onClick}>change</CMSmallButton>}
    />;
}


/////////////////////////////////////////////////////////////////////////////////////////////
export const UserTagIdBindingOperand2Component = (props: FieldComponentProps<TPK>) => {
    const dashboardContext = useDashboardContext();
    const val = toPkArray(props.binding.nodeDef.fieldValueOperand2);
    return <CMMultiSelect<TPK>
        displayStyle={CMSelectDisplayStyle.SelectedWithDialog}
        readonly={props.readonly}
        chipShape={"rounded"}
        chipSize={"small"}
        onChange={v => {
            props.binding.setOperand2(v);
        }}
        value={val}

        getOptions={(args) => dashboardContext.userTag.items.map(e => e.id)}
        renderOption={opt => (opt && (dashboardContext.userTag.getById(opt)?.text)) || "<none>"}
        getOptionInfo={opt => {
            const x = dashboardContext.userTag.getById(opt);
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
        setOperand2: args.setOperand2 || (() => {
            console.log(`setoperand2 needs to eventually be connected to workflowdef mutation.`);
        }),
        doesFieldValueSatisfyCompletionCriteria: () => {
            if (!args.nodeDef.fieldValueOperator) {
                return false;
            }
            const lhs: TPK = args.value;
            const rhs = toPkArray(args.nodeDef.fieldValueOperand2);
            switch (args.nodeDef.fieldValueOperator) {
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
                    //assertUnreachable(args.nodeDef.fieldValueOperator);
                    console.warn(`unknown FSV field operator ${args.nodeDef.fieldValueOperator}`);
                    return false;
            }
        },
        FieldValueComponent: args.FieldValueComponent,// (props) => <DB3ForeignSingleBindingValueComponent {...props} />,
        FieldOperand2Component: args.FieldOperand2Component,// (props) => <DB3ForeignSingleBindingOperand2Component {...props} />,
    };
};


