import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { readUserWikiContributions } from "src/core/wiki/server/userWikiContributions";
import { ZTGetUserWikiContributionsArgs } from "src/core/wiki/shared/wikiUtils";

export default resolver.pipe(
    resolver.zod(ZTGetUserWikiContributionsArgs),
    async (args, ctx: Ctx) => readUserWikiContributions(db, await loadAuthorization(ctx.session, args.bandPublicId), args),
);
