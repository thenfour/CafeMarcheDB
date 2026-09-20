import { resolver } from "@blitzjs/rpc";
import type { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { executeDB3Command } from "../server/db3CommandCore";
import { getDB3CommandHandler } from "../server/db3CommandRegistry";

const DB3CommandRequestSchema = z.object({
    commandID: z.string().min(1).max(128).regex(/^[A-Za-z][A-Za-z0-9_]*$/),
    payload: z.unknown(),
}).strict();

export type ExecuteDB3CommandRequest = z.infer<typeof DB3CommandRequestSchema>;

export default resolver.pipe(
    resolver.authorize(Permission.login),
    resolver.zod(DB3CommandRequestSchema),
    async (request: ExecuteDB3CommandRequest, ctx: AuthenticatedCtx) => {
        const handler = getDB3CommandHandler(request.commandID);
        return db.$transaction(
            transactionalDb => executeDB3Command({
                commandID: request.commandID,
                payload: request.payload,
            }, handler, ctx, transactionalDb),
            {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
                timeout: 120_000,
            },
        );
    },
);
