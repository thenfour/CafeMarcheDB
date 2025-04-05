// based off the structure/logic of getEventFilterInfo

import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { UserWithInstrumentsArgs, UserWithInstrumentsPayload } from "../db3";

export default resolver.pipe(
    resolver.authorize(Permission.basic_trust),
    resolver.zod(z.object({
        userId: z.number(),
    })),
    async (args, ctx: AuthenticatedCtx): Promise<UserWithInstrumentsPayload> => {
        const ret = await db.user.findUnique({
            where: {
                id: args.userId,
            },
            ...UserWithInstrumentsArgs
        });
        if (!ret) throw new Error(`user not found`);
        return ret;
    }
);



