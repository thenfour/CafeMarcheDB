import { resolver } from "@blitzjs/rpc"
import db, { Prisma } from "db";
import { DeleteByIdMutationImplementation } from "shared/associationUtils";
import { Permission } from "shared/permissions";
import utils, { ChangeAction, CreateChangeContext } from "shared/utils"
import { GetObjectByIdSchema } from "src/auth/schemas";

export default resolver.pipe(
    resolver.zod(GetObjectByIdSchema),
    resolver.authorize("deleteInstrumentTag", Permission.admin_general),
    async ({ id }, ctx) => {
        // replace tags with something else?
        return DeleteByIdMutationImplementation({
            changeContext: CreateChangeContext("deleteInstrumentTag"),
            ctx,
            id,
            tableName: "instrumentTag",
        });
    }
);

