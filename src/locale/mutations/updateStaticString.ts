import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db, { Prisma } from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { CreateChangeContext } from "src/auth/server/activityLog";
import { StaticStringWriteSchema } from "../shared/staticStringEdit";
import { writeStaticString } from "../server/staticStringEditor";

export default resolver.pipe(
    resolver.zod(StaticStringWriteSchema),
    async (command, ctx: Ctx) => {
        const auth = await loadAuthorization(ctx.session, command.target.bandPublicId);
        await db.$transaction(async tx => writeStaticString(tx, await auth.refresh(tx), command,
            CreateChangeContext("updateStaticString")), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    },
);
