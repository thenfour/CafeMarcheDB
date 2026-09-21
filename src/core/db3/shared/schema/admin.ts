import { Prisma } from "db";
import { Permission } from "shared/permissions";
import { ForeignSingleField, GenericIntegerField, GhostField, MakePKfield } from "../db3basicFields";
import * as db3 from "../db3core";
import { ChangeNaturalOrderBy, type ChangePayload } from "./prismArgs";
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

export const xChange = db3.defineTable({
    tableName: "Change",
    deletePolicy: "disabled",
    queryParameters: {
        tableNames: { kind: "stringArray", authorizeAs: "table", nullable: true },
        userIds: { kind: "integerArray", authorizeAs: "userId", nullable: true },
        recordId: { kind: "integer", authorizeAs: "recordId", nullable: true },
    },
    getSelectionArgs: (): Prisma.ChangeDefaultArgs => {
        return {
            include: {
                user: true,
            }
        };
    },
    getParameterizedWhereClause: (params: ChangeTableParams): Prisma.ChangeWhereInput[] => {
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
    fields: db3.makeColumnSet({
        id: () => MakePKfield(),

        action: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "raw",
            authMap: xSysadminColumnAuthMap,
        }),

        context: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "raw",
            authMap: xSysadminColumnAuthMap,
        }),

        operationId: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "raw",
            authMap: xSysadminColumnAuthMap,
        }),

        table: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "raw",
            authMap: xSysadminColumnAuthMap,
        }),

        recordId: columnName => new GenericIntegerField({
            columnName,
            allowNull: false,
            authMap: xSysadminColumnAuthMap,
        }),


        sessionHandle: columnName => new GenericStringField({
            columnName,
            allowNull: true,
            format: "raw",
            authMap: xSysadminColumnAuthMap,
        }),

        oldValues: columnName => new GenericStringField({
            columnName,
            allowNull: true,
            format: "raw",
            authMap: xSysadminColumnAuthMap,
        }),

        newValues: columnName => new GenericStringField({
            columnName,
            allowNull: true,
            format: "raw",
            authMap: xSysadminColumnAuthMap,
        }),

        user: columnName => new ForeignSingleField<Prisma.UserGetPayload<{}>>({
            columnName,
            fkidMember: "userId",
            allowNull: false,
            foreignTableID: "User",
            getQuickFilterWhereClause: (query: string) => false,
            authMap: xSysadminColumnAuthMap,
        }),

        changedAt: memberName => new GhostField({
            authMap: xSysadminColumnAuthMap,
            memberName,
        }),

    })
});
