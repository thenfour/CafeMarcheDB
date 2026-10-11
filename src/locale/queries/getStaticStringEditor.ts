import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db, { Prisma } from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { StaticStringTargetSchema } from "../shared/staticStringEdit";
import { loadStaticStringEditor } from "../server/staticStringEditor";

export default resolver.pipe(
    resolver.zod(StaticStringTargetSchema),
    async (target, ctx: Ctx) => {
        const auth = await loadAuthorization(ctx.session, target.bandPublicId);
        return db.$transaction(async tx => loadStaticStringEditor(tx, await auth.refresh(tx), target),
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    },
);
