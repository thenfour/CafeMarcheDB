import { resolver } from "@/src/auth/server/cmResolver";
import db, { Prisma } from "db";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";
import { Permission } from "shared/permissions";
import { UserSettingsPatchSchema } from "shared/userSettings";
import { loadUserSettings } from "../server/userSettings";

export default resolver.pipe(
    resolver.zod(UserSettingsPatchSchema),
    resolver.cmauthorize(Permission.login),
    async (patch, ctx) => db.$transaction(async tx => {
        const auth = await ctx.auth.refresh(tx);
        auth.requirePermission(Permission.login);
        const user = auth.requireUser();
        const changeContext = CreateChangeContext("updateMyUserSettings");

        for (const [name, value] of Object.entries(patch)) {
            if (value === undefined) continue;
            const existing = await tx.userSetting.findFirst({ where: { userId: user.id, name } });
            if (existing && JSON.stringify(existing.value) === JSON.stringify(value)) continue;

            const data = { userId: user.id, name, value };
            const saved = existing
                ? await tx.userSetting.update({ where: { id: existing.id }, data: { value } })
                : await tx.userSetting.create({ data });
            await RegisterChange({
                action: existing ? ChangeAction.update : ChangeAction.insert,
                changeContext,
                table: "UserSetting",
                pkid: saved.id,
                oldValues: existing ? { name, value: existing.value } : undefined,
                newValues: { name, value },
                ctx,
                db: tx,
            });
        }

        return loadUserSettings(user.id, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
);
