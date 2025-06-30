import { Prisma } from "db";
import { Permission } from "shared/permissions";
import { ForeignSingleField, GenericIntegerField, GhostField, MakePKfield } from "../db3basicFields";
import * as db3 from "../db3core";
import { ChangeNaturalOrderBy, ChangePayload } from "./prismArgs";
import { GenericStringField } from "../genericStringField";


export const xSysadminTableAuthMap: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.sysadmin,
    View: Permission.sysadmin,
    EditOwn: Permission.sysadmin,
    Edit: Permission.sysadmin,
    Insert: Permission.sysadmin,
} as const;

export const xSysadminColumnAuthMap: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.sysadmin,
    PostQuery: Permission.sysadmin,
    PreMutateAsOwner: Permission.sysadmin,
    PreMutate: Permission.sysadmin,
    PreInsert: Permission.sysadmin,
} as const;


export interface ChangeTableParams {
    tableNames?: string[] | null;
    userIds?: number[] | null;
    recordId?: number | null;
};

export const xChange = new db3.xTable({
    tableName: "Change",
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.ChangeInclude => {
        return {
            user: true,
        };
    },
    getParameterizedWhereClause: (params: ChangeTableParams, clientIntention): Prisma.ChangeWhereInput[] => {
        /*
        [
            {OR: [{ table: a }, { table: b }]},
            {OR: [{ userId: a }, { userId: b }]},
        ]
        */

        const ret: Prisma.ChangeWhereInput[] = [];

        if (params.tableNames && params.tableNames.length > 0) {
            ret.push({
                OR: params.tableNames.map(n => { return { table: n }; })
            });
        }

        if (params.userIds && params.userIds.length > 0) {
            ret.push({
                OR: params.userIds.map(n => { return { userId: n }; })
            });
        }

        if (!!params.recordId) {
            ret.push({
                recordId: params.recordId
            });
        }

        return ret;
    },
    tableAuthMap: xSysadminTableAuthMap,
    naturalOrderBy: ChangeNaturalOrderBy,
    getRowInfo: (row: ChangePayload) => ({
        pk: row.id,
        name: `${row.id}`,
        ownerUserId: null,
    }),
    columns: [
        MakePKfield(),

        new GenericStringField({
            columnName: "action",
            allowNull: false,
            format: "raw",
            authMap: xSysadminColumnAuthMap,
        }),

        new GenericStringField({
            columnName: "context",
            allowNull: false,
            format: "raw",
            authMap: xSysadminColumnAuthMap,
        }),

        new GenericStringField({
            columnName: "operationId",
            allowNull: false,
            format: "raw",
            authMap: xSysadminColumnAuthMap,
        }),

        new GenericStringField({
            columnName: "table",
            allowNull: false,
            format: "raw",
            authMap: xSysadminColumnAuthMap,
        }),

        new GenericIntegerField({
            columnName: "recordId",
            allowNull: false,
            authMap: xSysadminColumnAuthMap,
        }),


        new GenericStringField({
            columnName: "sessionHandle",
            allowNull: true,
            format: "raw",
            authMap: xSysadminColumnAuthMap,
        }),

        new GenericStringField({
            columnName: "oldValues",
            allowNull: true,
            format: "raw",
            authMap: xSysadminColumnAuthMap,
        }),

        new GenericStringField({
            columnName: "newValues",
            allowNull: true,
            format: "raw",
            authMap: xSysadminColumnAuthMap,
        }),

        new ForeignSingleField<Prisma.UserGetPayload<{}>>({
            columnName: "user",
            fkidMember: "userId",
            allowNull: false,
            foreignTableID: "User",
            getQuickFilterWhereClause: (query: string) => false,
            authMap: xSysadminColumnAuthMap,
        }),

        new GhostField({
            authMap: xSysadminColumnAuthMap,
            memberName: "changedAt",
        }),

    ]
});