// updateEventWorkflowModel
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";


export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (args: {}, ctx: AuthenticatedCtx) => {
        debugger; // todo: this mutation.
        return {};
    }
);

