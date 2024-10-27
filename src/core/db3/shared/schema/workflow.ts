
import { Prisma } from "db";
import { Permission } from "shared/permissions";
import { TAnyModel, TUpdateEventWorkflowInstanceArgs, WorkflowNodeProgressState } from "../apiTypes";
import { BoolField, GenericStringField, GhostField, MakeColorAsStringField, MakeMarkdownTextField, MakeSortOrderField, MakeTitleField, PKField } from "../db3basicFields";
import * as db3 from "../db3core";
import { gGeneralPaletteList } from "shared/color";

// (todo: refine these)
const xColumnAuthMap: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.visibility_logged_in_users,
    PostQuery: Permission.visibility_logged_in_users,
    PreMutateAsOwner: Permission.visibility_logged_in_users,
    PreMutate: Permission.visibility_logged_in_users,
    PreInsert: Permission.visibility_logged_in_users,
} as const;

const xTableAuthMap: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.visibility_logged_in_users,
    View: Permission.visibility_logged_in_users,
    EditOwn: Permission.visibility_logged_in_users,
    Edit: Permission.visibility_logged_in_users,
    Insert: Permission.visibility_logged_in_users,
} as const;

// when you load a workflow, it's either for the entire thing, or for evaluation.
const WorkflowDefArgs_Search = Prisma.validator<Prisma.WorkflowDefDefaultArgs>()({
    include: {
    },
});

const WorkflowDefArgs_Verbose = Prisma.validator<Prisma.WorkflowDefDefaultArgs>()({
    include: {
        groups: true,
        nodeDefs: {
            include: {
                defaultAssignees: true,
                dependenciesAsTarget: true,
            }
        }
    },
});

export type WorkflowDef_Minimum = Prisma.WorkflowDefGetPayload<{}>;
export type WorkflowDef_SearchPayload = Prisma.WorkflowDefGetPayload<typeof WorkflowDefArgs_Search>;
export type WorkflowDef_Verbose = Prisma.WorkflowDefGetPayload<typeof WorkflowDefArgs_Verbose>;

export const WorkflowDefNaturalOrderBy: Prisma.WorkflowDefOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
    { description: 'asc' },
    { id: 'asc' },
];


export const xWorkflowDefArgs: Omit<db3.TableDesc, "getInclude"> = {
    tableName: "WorkflowDef", // case matters :(
    tableAuthMap: xTableAuthMap,
    naturalOrderBy: WorkflowDefNaturalOrderBy,
    getRowInfo: (row: WorkflowDef_Minimum) => ({
        pk: row.id,
        name: `${row.name}${row.isDefaultForEvents ? " (🟢default)" : ""}`,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color || null),
        ownerUserId: null,
    }),

    getParameterizedWhereClause: (params: TAnyModel, clientIntention: db3.xTableClientUsageContext) => {
        return false;
    },
    columns: [
        new PKField({ columnName: "id" }),

        MakeTitleField("name", { authMap: xColumnAuthMap, }),
        MakeMarkdownTextField("description", { authMap: xColumnAuthMap, }),
        MakeSortOrderField("sortOrder", { authMap: xColumnAuthMap, }),
        MakeColorAsStringField("color", { authMap: xColumnAuthMap, }),
        new BoolField({ columnName: "isDeleted", defaultValue: false, authMap: xColumnAuthMap, allowNull: false }),

        new BoolField({ columnName: "isDefaultForEvents", defaultValue: false, authMap: xColumnAuthMap, allowNull: false }),

        new GhostField({ memberName: "nodeDefs", authMap: xColumnAuthMap }),
        new GhostField({ memberName: "groups", authMap: xColumnAuthMap }),
        new GhostField({ memberName: "instances", authMap: xColumnAuthMap }),
    ]
};

export const xWorkflowDef_Search = new db3.xTable({
    ...xWorkflowDefArgs,
    getInclude: (clientIntention, filterModel): Prisma.EventInclude => {
        return WorkflowDefArgs_Search.include;
    },
});

export const xWorkflowDef_Verbose = new db3.xTable({
    ...xWorkflowDefArgs,
    getInclude: (clientIntention, filterModel): Prisma.WorkflowDefInclude => {
        return WorkflowDefArgs_Verbose.include;
    },
});


//////////////////////////////////////////////////////////////////////////////////////////////////////////////


const WorkflowInstanceArgs_Verbose = Prisma.validator<Prisma.WorkflowInstanceDefaultArgs>()({
    include: {
        logItems: true,
        nodes: {
            include: {
                assignees: true,
                lastAssignees: true,
            }
        }
    },
});

export type WorkflowInstance_Verbose = Prisma.WorkflowInstanceGetPayload<typeof WorkflowInstanceArgs_Verbose>;

export const xWorkflowInstanceArgs: Omit<db3.TableDesc, "getInclude"> = {
    tableName: "WorkflowInstance", // case matters :(
    tableAuthMap: xTableAuthMap,
    //naturalOrderBy: WorkflowDefNaturalOrderBy,
    getRowInfo: (row: Prisma.WorkflowInstanceGetPayload<{}>) => ({
        pk: row.id,
        name: `(instance ${String(row.lastEvaluatedWorkflowDefId)})`,
        ownerUserId: null,
    }),

    getParameterizedWhereClause: (params: TAnyModel, clientIntention: db3.xTableClientUsageContext) => {
        return false;
    },
    columns: [
        new PKField({ columnName: "id" }),
        new GhostField({ memberName: "lastEvaluatedWorkflowDef", authMap: xColumnAuthMap }),
        new GhostField({ memberName: "logItems", authMap: xColumnAuthMap }),
        new GhostField({ memberName: "nodes", authMap: xColumnAuthMap }),
        new GhostField({ memberName: "events", authMap: xColumnAuthMap }),
    ]
};

export const xWorkflowInstance_Verbose = new db3.xTable({
    ...xWorkflowInstanceArgs,
    getInclude: (clientIntention, filterModel): Prisma.WorkflowInstanceInclude => {
        return WorkflowInstanceArgs_Verbose.include;
    },
});


export function WorkflowInstanceQueryResultToMutationArgs(x: WorkflowInstance_Verbose, eventId: number): TUpdateEventWorkflowInstanceArgs {
    return {
        instance: {
            id: x.id,
            lastEvaluatedWorkflowDefId: x.lastEvaluatedWorkflowDefId || undefined,
            nodeInstances: x.nodes.map(node => ({
                id: node.id,
                nodeDefId: node.nodeDefId,
                assignees: [...node.assignees],
                dueDate: node.dueDate || undefined,
                manuallyCompleted: node.manuallyCompleted,
                manualCompletionComment: node.manualCompletionComment || undefined,
                lastFieldName: node.lastFieldName,
                lastFieldValueAsString: node.lastFieldValueAsString,
                lastAssignees: [...node.lastAssignees],
                activeStateFirstTriggeredAt: node.activeStateFirstTriggeredAt || undefined,
                lastProgressState: (node.lastProgressState || WorkflowNodeProgressState.InvalidState) as WorkflowNodeProgressState,
            })),
        },
        eventId,
    };
};

