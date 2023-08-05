import { resolver } from "@blitzjs/rpc"
import db, { Prisma } from "db";
import { DeleteByIdMutationImplementation } from "shared/associationUtils";
import { Permission } from "shared/permissions";
import { ChangeAction, CreateChangeContext } from "shared/utils"
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
    }
);

