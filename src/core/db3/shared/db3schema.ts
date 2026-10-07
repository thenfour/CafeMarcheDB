// Settings use registered hive commands, never generic DB3 storage access.
export {};

// MIGRATION_RESTORE: settings-editors
// Source: 14c644c1242b8bfac9190afe3ac05ebf2573c49d:src/core/db3/shared/db3schema.ts:1-69
// Reason: The old generic settings descriptor and editors use removed storage APIs.
// Restore: Account for legacy settings and branding editor workflows using typed hives and per-key authorization; preserve scheduling reanchor and cache invalidation semantics.
// Verification: Adapt preserved user/branding/setting authorization specifications and native time-zone tests; verify editor saves and resets in the built app.
// SHA256: eb5512fffa700c89878b510c6385d7062956957d68bceb080e5e7a18d6626935
// MIGRATION_REFERENCE_BEGIN
// // note: many-to-many associations we treat mostly as "tags".
// // both sides of the relationship are NOT equal; for example the association model will specify the tags field but not the local field,
// // because we don't show the data from the tags perspective. we show it from the local perspective therefore we don't need that data, and specifying it would encounter circular references etc.
//
// // another example of the imbalanced relationship:
// // the "name" of an association model will be the tag. not the local object.
//
// import { Prisma } from "db";
// import { Permission } from "shared/permissions";
// import { MakePKfield, MakePublicIdField } from "./columnTypes/xTableColumnTypes";
// import type { SettingPublicId } from "shared/publicId";
// import { DB3AuthTablePermissionMap, defineAuthMap, defineTable, makeColumnSet, prismaModel, SqlSpecialColumnFunction } from "./db3core";
// import { GenericStringField } from "./columnTypes/genericString";
//
//
// export const xSettingsAuthMap = defineAuthMap({
//     PostQueryAsOwner: Permission.sysadmin,
//     PostQuery: Permission.sysadmin,
//     PreMutateAsOwner: Permission.sysadmin,
//     PreMutate: Permission.sysadmin,
//     PreInsert: Permission.sysadmin,
// });
//
// export const xSettingsTableAuthMap: DB3AuthTablePermissionMap = {
//     ViewOwn: Permission.sysadmin,
//     View: Permission.sysadmin,
//     EditOwn: Permission.sysadmin,
//     Edit: Permission.sysadmin,
//     Insert: Permission.sysadmin,
// };
//
//
// export type SettingPayload = Prisma.SettingGetPayload<{}>;
// export const SettingNaturalOrderBy: Prisma.SettingOrderByWithRelationInput[] = [
//     { name: 'asc' },
//     { id: 'asc' },
// ];
//
// export const xSetting = defineTable({
//     prismaModel: prismaModel<Prisma.SettingDelegate>(),
//     getIdentity: (setting: { publicId: SettingPublicId }) => setting.publicId,
//     getSelectionArgs: () => ({}),
//     tableName: "Setting",
//     deletePolicy: "disabled",
//     tableAuthMap: xSettingsTableAuthMap,
//     naturalOrderBy: SettingNaturalOrderBy,
//     getRowInfo: (row: SettingPayload) => ({
//         pk: row.publicId,
//         name: row.name,
//         ownerUserId: null,
//     }),
//     fields: makeColumnSet({
//         id: () => MakePKfield({ naturalIdVisibility: "never" }),
//         publicId: () => MakePublicIdField<SettingPublicId>(),
//         name: columnName => new GenericStringField({
//             columnName,
//             allowNull: false,
//             format: "plain",
//             specialFunction: SqlSpecialColumnFunction.name,
//             authMap: xSettingsAuthMap,
//         }),
//         value: columnName => new GenericStringField({
//             columnName,
//             allowNull: false,
//             format: "plain",
//             authMap: xSettingsAuthMap,
//         }),
//     })
// });
// MIGRATION_REFERENCE_END
