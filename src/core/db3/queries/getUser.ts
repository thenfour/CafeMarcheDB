// based off the structure/logic of getEventFilterInfo

import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { z } from "zod";
import { DB3QueryCore } from "../server/db3QueryCore";
import { UserPayload_Name } from "../shared/schema/prismArgs";
import { xUser } from "../db3";

export default resolver.pipe(
    resolver.zod(z.object({
        userId: z.number(),
    })),
    async (args, ctx: AuthenticatedCtx): Promise<UserPayload_Name | null> => {
        const result = await DB3QueryCore({
            tableID: xUser.tableID,
            tableName: xUser.tableName,
            orderBy: undefined,
            filter: {
                items: [],
                tableParams: { userId: args.userId },
            },
            take: 1,
            cmdbQueryContext: "getUser",
        }, ctx);
        return (result.items[0] as UserPayload_Name | undefined) ?? null;
    }
);



