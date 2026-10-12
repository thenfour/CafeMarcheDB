import { Prisma } from "db";
import { Permission } from "shared/permissions";
import { GenericStringField } from "../columnTypes/genericString";
import { DateTimeField, GenericIntegerField, MakePKfield } from "../columnTypes/xTableColumnTypes";
import { defineAuthMap, defineTable, makeColumnSet, prismaModel } from "../db3core";

const auditFieldAuth = defineAuthMap({
    PostQuery: Permission.sysadmin, PostQueryAsOwner: Permission.sysadmin,
    PreMutate: Permission.never_grant, PreMutateAsOwner: Permission.never_grant, PreInsert: Permission.never_grant,
});

export interface ChangeTableParams {
    tableNames?: string[] | null;
    userIds?: string[] | null;
}

const changeSelection = Prisma.validator<Prisma.ChangeDefaultArgs>()({
    select: {
        id: true, action: true, context: true, operationId: true, table: true, recordId: true,
        changedAt: true, sessionHandle: true, oldValues: true, newValues: true,
        userId: true,
    },
});
export const xChange = defineTable({
    tableName: "Change", prismaModel: prismaModel<Prisma.ChangeDelegate>(),
    // Audit rows have an operational identity; business references never use this natural key.
    getIdentity: (row: { id: number }) => row.id,
    deletePolicy: "disabled", readConsistency: "snapshot",
    tableAuthMap: {
        View: Permission.sysadmin, ViewOwn: Permission.sysadmin,
        Edit: Permission.never_grant, EditOwn: Permission.never_grant, Insert: Permission.never_grant,
    },
    getSelectionArgs: () => changeSelection,
    naturalOrderBy: [{ id: "desc" }],
    queryParameters: {
        tableNames: { kind: "stringArray", authorizeAs: "table", nullable: true },
        userIds: { kind: "stringArray", authorizeAs: "userId", nullable: true },
    },
    getParameterizedWhereClause: (params: ChangeTableParams): Prisma.ChangeWhereInput[] => [
        ...(params.tableNames?.length ? [{ table: { in: params.tableNames } }] : []),
        ...(params.userIds?.length ? [{ user: { publicId: { in: params.userIds } } }] : []),
    ],
    getRowInfo: row => ({ pk: row.id, name: String(row.id), ownerUserId: null }),
    fields: makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        action: columnName => new GenericStringField({ columnName, allowNull: false, format: "raw", authMap: auditFieldAuth }),
        context: columnName => new GenericStringField({ columnName, allowNull: false, format: "raw", authMap: auditFieldAuth }),
        operationId: columnName => new GenericStringField({ columnName, allowNull: false, format: "raw", authMap: auditFieldAuth }),
        table: columnName => new GenericStringField({ columnName, allowNull: false, format: "raw", authMap: auditFieldAuth }),
        recordId: columnName => new GenericIntegerField({ columnName, allowNull: false, authMap: auditFieldAuth }),
        sessionHandle: columnName => new GenericStringField({ columnName, allowNull: true, format: "raw", allowQuickFilter: false, authMap: auditFieldAuth }),
        oldValues: columnName => new GenericStringField({ columnName, allowNull: true, format: "raw", allowQuickFilter: false, authMap: auditFieldAuth }),
        newValues: columnName => new GenericStringField({ columnName, allowNull: true, format: "raw", allowQuickFilter: false, authMap: auditFieldAuth }),
        userId: columnName => new GenericIntegerField({ columnName, allowNull: true, authMap: auditFieldAuth }),
        changedAt: columnName => new DateTimeField({ columnName, allowNull: false, authMap: auditFieldAuth }),
    }),
});

declare module "../db3core" {
    interface DB3TableTypeRegistry {
        Change: typeof xChange;
    }
}
