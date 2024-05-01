import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx, paginate } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { TAnyModel } from "../shared/apiTypes";
import { randomUUID } from "crypto";
import { DB3PaginatedQueryCore } from "../server/db3QueryCore";

export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (input: db3.PaginatedQueryInput, ctx: AuthenticatedCtx) => {
        try {
            return await DB3PaginatedQueryCore(input, ctx);
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);





