// Preserved migration reference only. The empty export keeps this file a TypeScript module.
export {};


// MIGRATION_RESTORE: settings-editors
// Source: c4002c5f2ee1f79ee5f0501fb8f2382a32f2e8c4:src/setting/server/settingWrite.ts:1-100
// Reason: Old setting readers, writers and tests were removed while typed settings replaced the storage contract.
// Restore: Account for legacy settings and branding editor workflows using typed hives and per-key authorization; preserve scheduling reanchor and cache invalidation semantics.
// Verification: Adapt preserved user/branding/setting authorization specifications and native time-zone tests; verify editor saves and resets in the built app.
// SHA256: 70681f1055d04fdf0214763c835127aef761f1e6c9f2b34efa3e027a206da465
// MIGRATION_REFERENCE_BEGIN
// import { ChangeAction, type ChangeContext, RegisterChange } from "@/src/auth/server/activityLog";
// import { isBandTimeZoneSetting, reanchorAllDayEvents } from "src/server/dateTime";
// import type { CMServerAuthorization } from "../../auth/server/serverAuthorization";
// import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
// import type { Prisma } from "db";
// import { db3Server } from "src/core/db3/server/db3Server";
// import { xSetting } from "src/core/db3/shared/db3schema";
// import { resolveBandTimeZone } from "shared/dateTimePolicy";
// import { Setting } from "shared/settingKeys";
// import { loadBandTimeZone } from "@/src/server/bandTimeZone";
//
// export type SettingValue = Prisma.SettingGetPayload<{}>;
//
// // Generic setting editors must enforce the same scheduling contract as the
// // branding form. Empty values retain their existing clear/default semantics.
// export function validateSettingValue(name: string | undefined, value: string | null | undefined): void {
//     if (name?.trim().toLowerCase() === Setting.BandTimeZone.toLowerCase()) {
//         resolveBandTimeZone(value);
//     }
// }
//
// // Delegated branding managers may change only declared branding keys. DB3's
// // Setting mutation policy is Sysadmin-only, and its delete policy cannot model
// // clearing an empty setting. Keep this narrow name-based writer behind the
// // callers' fresh permission checks and shared serializable transactions.
// export const writeSettingValue = async (args: {
//     db: TransactionalPrismaClient;
//     auth: CMServerAuthorization;
//     changeContext: ChangeContext;
//     name: string;
//     value: string | null | undefined;
// }): Promise<SettingValue | null> => {
//     validateSettingValue(args.name, args.value);
//     const oldValue = await args.db.setting.findFirst({ where: { name: args.name } });
//     if (oldValue && oldValue.name !== args.name) {
//         validateSettingValue(oldValue.name, args.value);
//     }
//     const refreshBounds = async () => {
//         if (isBandTimeZoneSetting(args.name) || isBandTimeZoneSetting(oldValue?.name)) {
//             await reanchorAllDayEvents(
//                 args.db,
//                 resolveBandTimeZone(oldValue?.value?.trim()),
//                 await loadBandTimeZone(args.db)
//             );
//         }
//     };
//     if (args.value === null || args.value === undefined || args.value === "") {
//         if (!oldValue) return null;
//         await args.db.setting.delete({ where: { id: oldValue.id } });
//         await RegisterChange({
//             action: ChangeAction.delete,
//             changeContext: args.changeContext,
//             table: "setting",
//             pkid: oldValue.id,
//             oldValues: oldValue,
//             auth: args.auth,
//             db: args.db,
//         });
//         await refreshBounds();
//         return null;
//     }
//
//     if (oldValue) {
//         if (oldValue.value === args.value) return oldValue;
//         const newValue = await args.db.setting.update({
//             where: { id: oldValue.id },
//             data: { value: args.value },
//         });
//         await RegisterChange({
//             action: ChangeAction.update,
//             changeContext: args.changeContext,
//             table: "setting",
//             pkid: oldValue.id,
//             oldValues: oldValue,
//             newValues: newValue,
//             auth: args.auth,
//             db: args.db,
//         });
//         await refreshBounds();
//         return newValue;
//     }
//
//     const value = args.value;
//     const settingDelegate = args.db.setting as Prisma.SettingDelegate; // The transactional client preserves Prisma's Setting delegate.
//     const newValue = await db3Server.table(xSetting).createWithPublicId(publicId =>
//         settingDelegate.create({
//             data: { publicId, name: args.name, value },
//         }));
//     await RegisterChange({
//         action: ChangeAction.insert,
//         changeContext: args.changeContext,
//         table: "setting",
//         pkid: newValue.id,
//         newValues: newValue,
//         auth: args.auth,
//         db: args.db,
//     });
//     await refreshBounds();
//     return newValue;
// };
// MIGRATION_REFERENCE_END
