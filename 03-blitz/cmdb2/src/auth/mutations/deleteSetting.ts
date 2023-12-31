import { paginate } from "blitz";
import { resolver } from "@blitzjs/rpc"
import { NotFoundError } from "blitz";
import db, { Prisma } from "db";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/utils"
import { DeleteByIdSchema } from "../schemas"
import { Permission } from "shared/permissions";

export default resolver.pipe(
    resolver.zod(DeleteByIdSchema),
    resolver.authorize(Permission.content_admin),
    async ({ id }, ctx) => {
        try {
            const oldValues = await db.setting.findFirst({ where: { id } });

            const choice = await db.permission.deleteMany({ where: { id } });

            await RegisterChange({
                action: ChangeAction.delete,
                changeContext: CreateChangeContext("deleteSettingMutation"),
                table: "setting",
                pkid: id,
                oldValues: oldValues,
                ctx,
            });

            return choice;
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);

