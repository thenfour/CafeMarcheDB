import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { DB3QueryCore } from "../server/db3QueryCore";
import { validateDB3QueryRequest } from "../server/db3RequestValidation";

export default resolver.pipe(
    async (input: unknown, ctx: AuthenticatedCtx) => {
        return await DB3QueryCore(validateDB3QueryRequest(input), ctx);
    }
);



