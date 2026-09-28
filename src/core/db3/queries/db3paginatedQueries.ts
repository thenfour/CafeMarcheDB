import { cmauthorize } from "@/src/auth/server/cmResolver";
import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import { DB3PaginatedQueryCore } from "../server/db3QueryCore";
import { validateDB3PaginatedQueryRequest } from "../server/db3RequestValidation";

export default resolver.pipe(
    cmauthorize(Permission.login),
    async (input: unknown, ctx) => {
        try {
            return await DB3PaginatedQueryCore(
                validateDB3PaginatedQueryRequest(input),
                ctx.auth
            );
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);





