import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import { SetRoleDesignationInput } from "../roleDesignations";
import db, { Prisma } from "db";
import { loadAuthorization } from "../server/serverAuthorization";
import { writeRoleDesignation } from "../server/roleDesignationWrite";

export default resolver.pipe(
    resolver.zod(SetRoleDesignationInput),
    async (edit, ctx: Ctx) => {
        const auth = await loadAuthorization(ctx.session, null);
        return db.$transaction(tx => writeRoleDesignation(tx, auth, edit),
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    },
);
