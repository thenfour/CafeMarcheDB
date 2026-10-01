import { resolver } from "@blitzjs/rpc";
import { cmauthorize } from "@/src/auth/server/cmResolver";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { UserSettingsPatchSchema } from "@/src/setting/shared/userSettings";
import { loadUserSettings } from "../userSettings";

export default resolver.pipe(
    resolver.zod(UserSettingsPatchSchema),
    cmauthorize(Permission.login),
    async (patch, ctx) => db.$transaction(async tx => {
        const auth = await ctx.auth.refresh(tx);
        auth.requirePermission(Permission.login);
        const user = auth.requireUser();

        for (const [name, value] of Object.entries(patch)) {
            if (value === undefined) continue;
            const existing = await tx.userSetting.findFirst({ where: { userId: user.userId, name } });
            if (existing && JSON.stringify(existing.value) === JSON.stringify(value)) continue;

            const data = { userId: user.userId, name, value };
            const saved = existing
                ? await tx.userSetting.update({ where: { id: existing.id }, data: { value } })
                : await tx.userSetting.create({ data });
            // await RegisterChange({
            //     action: existing ? ChangeAction.update : ChangeAction.insert,
            //     changeContext,
            //     table: "UserSetting",
            //     pkid: saved.id,
            //     oldValues: existing ? { name, value: existing.value } : undefined,
            //     newValues: { name, value },
            //     auth,
            //     db: tx,
            // });
        }

        return loadUserSettings(user.userId, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
);
