import { resolver } from "@blitzjs/rpc"
import db, { Prisma } from "db";
import { DeleteByIdMutationImplementation } from "shared/associationUtils";
import { Permission } from "shared/permissions";
import utils, { ChangeAction, CreateChangeContext } from "shared/utils"
import { GetObjectByIdSchema } from "src/auth/schemas";


export default resolver.pipe(
    resolver.zod(GetObjectByIdSchema),
    resolver.authorize("deleteInstrument", Permission.admin_general),
    async ({ id }, ctx) => {
        return DeleteByIdMutationImplementation({
            changeContext: CreateChangeContext("deleteInstrument"),
            ctx,
            id,
            tableName: "instrument",
        });
        // try {
        //     const oldValues = await db.instrument.findFirst({ where: { id } });

        //     const choice = await db.instrument.deleteMany({ where: { id } });

        //     await utils.RegisterChange({
        //         action: ChangeAction.delete,
        //         context: "deleteInstrument",
        //         table: "instrument",
        //         pkid: id,
        //         oldValues,
        //         ctx,
        //     });

        //     return choice;
        // } catch (e) {
        //     console.error(e);
        //     throw (e);
        // }
    }
);

