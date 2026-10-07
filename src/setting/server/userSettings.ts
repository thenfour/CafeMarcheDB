// Preserved migration reference only. The empty export keeps this file a TypeScript module.
export {};


// MIGRATION_RESTORE: settings-editors
// Source: c4002c5f2ee1f79ee5f0501fb8f2382a32f2e8c4:src/setting/server/userSettings.ts:1-16
// Reason: Old setting readers, writers and tests were removed while typed settings replaced the storage contract.
// Restore: Account for legacy settings and branding editor workflows using typed hives and per-key authorization; preserve scheduling reanchor and cache invalidation semantics.
// Verification: Adapt preserved user/branding/setting authorization specifications and native time-zone tests; verify editor saves and resets in the built app.
// SHA256: 708d5fc20503aba62af635dca5c3d8f3d901d19d3f342d2b3ed4586cd9917097
// MIGRATION_REFERENCE_BEGIN
// import db from "db";
// import { resolveUserSettings } from "@/src/setting/shared/userSettings";
// import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
//
// export const loadUserSettings = async (
//     userId: number | null, // anonymous users still get default settings (they are considered users on the site)
//     database: TransactionalPrismaClient = db,
// ) => {
//     if (userId == null) {
//         return resolveUserSettings([]);
//     }
//     return resolveUserSettings(await database.userSetting.findMany({
//         where: { userId },
//         select: { name: true, value: true },
//     }));
// };
// MIGRATION_REFERENCE_END
