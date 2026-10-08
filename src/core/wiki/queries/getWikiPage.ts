import { resolver } from "@blitzjs/rpc";
import type { AuthenticatedCtx } from "blitz";
import db from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { GetWikiPageCore } from "../server/getWikiPageCore";
import { TGetWikiPageArgs, ZTGetWikiPageArgs } from "../shared/wikiUtils";

export default resolver.pipe(
    resolver.zod(ZTGetWikiPageArgs),
    async (args: TGetWikiPageArgs, ctx: AuthenticatedCtx) => GetWikiPageCore({
        canonicalWikiSlug: args.canonicalWikiPath,
        clientBaseContentVersion: args.baseContentVersion,
        clientBaseRevisionId: args.baseRevisionId,
        clientLockId: args.lockId,
        authorization: await loadAuthorization(ctx.session, args.bandPublicId),
        database: db,
    }),
);
