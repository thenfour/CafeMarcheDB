import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { queryTable } from "../server/db3QueryCore";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { validateDB3QueryRequest } from "../server/db3RequestValidation";

export default resolver.pipe(
    async (input: unknown, ctx: AuthenticatedCtx) => {
        return await queryTable(validateDB3QueryRequest(input),
            await loadAuthorization(ctx.session));
    }
);



