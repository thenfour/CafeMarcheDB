import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
//import * as db3 from "../db3";
import { AuthenticatedMiddlewareCtx } from "blitz";
import { CMDBAuthorizeOrThrow } from "types";
import * as db3 from "../../../../core/db3/db3";
import * as mutationCore from "../../../../core/db3/server/db3mutationCore";

export default resolver.pipe(
    resolver.authorize("db3query", Permission.login),
    async (input: {}, ctx: AuthenticatedMiddlewareCtx) => {
    }
);



