import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { RegisterActivitySchema } from "../schemas";
import { Permission } from "shared/permissions";
import utils, { Action, ChangeAction } from "shared/utils"

// btw, how will we prevent abuse of this API? is that a problem? maybe some kind of server-generated single-use token sent to the page that we can verify?

// type RegisterActivityArgs = Prisma.ActivityCreateInput & {
//     password?: string;
//   };

export default resolver.pipe(
    resolver.zod(RegisterActivitySchema),
    async (fields, ctx) => {
        try {
            const obj = await utils.RegisterActivity({
                ctx,
                action: fields.action as Action,
                data: fields.data,
            });
            return obj;
        } catch (e) {
            console.error(`Exception while registering activity`);
            console.error(e);
            throw (e);
        }
    }
);
