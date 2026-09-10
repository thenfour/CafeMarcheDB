import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { Permission } from "shared/permissions";
import { DB3PaginatedQueryCore } from "../server/db3QueryCore";
import { validateDB3PaginatedQueryRequest } from "../server/db3RequestValidation";

export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (input: unknown, ctx: AuthenticatedCtx) => {
        try {
            return await DB3PaginatedQueryCore(validateDB3PaginatedQueryRequest(input), ctx);
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);





