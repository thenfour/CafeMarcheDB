import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";
import { Permission } from "shared/permissions";
import { UserSettingsPatchSchema } from "shared/userSettings";
import { requireFreshPermission } from "../server/permissionAuthorization";
import { loadUserSettings } from "../server/userSettings";

export default resolver.pipe(
    resolver.zod(UserSettingsPatchSchema),
    resolver.authorize(Permission.login),
    async (patch, ctx) => db.$transaction(async tx => {
        const user = await requireFreshPermission(tx, ctx.session.userId, Permission.login);
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
