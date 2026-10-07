import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db, { Prisma } from "db";
import { CreateChangeContext } from "src/auth/server/activityLog";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { BandPublicIdSchema } from "src/locale/shared/presentationInput";
import { clearBrandCache } from "src/server/brand";
import { SettingCommandSchema } from "../../shared/settingsContract";
import { writeSettings } from "../settings";

export default resolver.pipe(
    resolver.zod(SettingCommandSchema.extend({ bandPublicId: BandPublicIdSchema.nullish() }).strict()),
    async (input, ctx: Ctx) => {
        const auth = await loadAuthorization(ctx.session, input.bandPublicId);
        await db.$transaction(async tx => {
            const fresh = await auth.refresh(tx);
            await writeSettings(tx, fresh, [input], CreateChangeContext("updateSetting"));
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 });
        clearBrandCache();
    },
);


// MIGRATION_RESTORE: settings-editors
// Source: c4002c5f2ee1f79ee5f0501fb8f2382a32f2e8c4:src/setting/server/mutations/updateMyUserSettings.ts:1-41
// Reason: Old setting readers, writers and tests were removed while typed settings replaced the storage contract.
// Restore: Account for legacy settings and branding editor workflows using typed hives and per-key authorization; preserve scheduling reanchor and cache invalidation semantics.
// Verification: Adapt preserved user/branding/setting authorization specifications and native time-zone tests; verify editor saves and resets in the built app.
// SHA256: 4a1e2a70983b22639b4bfe547e58f7e8704a5a0eb6577e83328035872216aa00
// MIGRATION_REFERENCE_BEGIN
// import { ChangeAction, CreateChangeContext, RegisterChange } from "@/src/auth/server/activityLog";
// import { resolver } from "@blitzjs/rpc";
// import { cmauthorize } from "@/src/auth/server/cmResolver";
// import db, { Prisma } from "db";
// import { Permission } from "shared/permissions";
// import { UserSettingsPatchSchema } from "@/src/setting/shared/userSettings";
// import { loadUserSettings } from "../userSettings";
//
// export default resolver.pipe(
//     resolver.zod(UserSettingsPatchSchema),
//     cmauthorize(Permission.login),
//     async (patch, ctx) => db.$transaction(async tx => {
//         const auth = await ctx.auth.refresh(tx);
//         auth.requirePermission(Permission.login);
//         const user = auth.requireUser();
//         const changeContext = CreateChangeContext("updateMyUserSettings");
//
//         for (const [name, value] of Object.entries(patch)) {
//             if (value === undefined) continue;
//             const existing = await tx.userSetting.findFirst({ where: { userId: user.userId, name } });
//             if (existing && JSON.stringify(existing.value) === JSON.stringify(value)) continue;
//
//             const data = { userId: user.userId, name, value };
//             const saved = existing
//                 ? await tx.userSetting.update({ where: { id: existing.id }, data: { value } })
//                 : await tx.userSetting.create({ data });
//             await RegisterChange({
//                 action: existing ? ChangeAction.update : ChangeAction.insert,
//                 changeContext,
//                 table: "UserSetting",
//                 pkid: saved.id,
//                 oldValues: existing ? { name, value: existing.value } : undefined,
//                 newValues: { name, value },
//                 auth,
//                 db: tx,
//             });
//         }
//
//         return loadUserSettings(user.userId, tx);
//     }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
// );
// MIGRATION_REFERENCE_END
