import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import * as db3 from "../db3";
import { DB3QueryCore } from "../server/db3QueryCore";

export default resolver.pipe(
    async (input: db3.QueryInput, ctx: AuthenticatedCtx) => {
        return await DB3QueryCore(input, ctx);
    }
);



