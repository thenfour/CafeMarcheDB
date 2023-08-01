import { SecurePassword } from "@blitzjs/auth/secure-password";
import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { InsertUserSchema, Signup } from "../schemas";
import { CreatePublicData } from "types";
import utils, { ChangeAction } from "shared/utils"
import { Permission } from "shared/permissions";
import { z } from "zod"

// type CreateInput = Prisma.UserCreateInput & {
//   password?: string;
// };

type InputType = z.infer<typeof InsertUserSchema>;

export default resolver.pipe(
    resolver.zod(InsertUserSchema),
    resolver.authorize("createUser", Permission.admin_users),
    async (fields: InputType, ctx: any) => {
        try {
            const user = await db.user.create({
                data: {
                    ...fields,
                    isSysAdmin: (fields.email == process.env.ADMIN_EMAIL),
                },
                include: { role: { include: { permissions: { include: { permission: true } } } } }
            });


            await utils.RegisterChange({
                action: ChangeAction.insert,
                context: "Insert user",
                table: "user",
                pkid: user.id,
                newValues: user,
                ctx,
            });

            return user;

        } catch (e) {
            console.error(`Exception while creating user`);
            console.error(e);
            throw (e);
        }
    });
