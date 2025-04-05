// based off the structure/logic of getEventFilterInfo

import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { TGetWikiPageArgs, ZTGetWikiPageArgs } from "src/core/wiki/shared/wikiUtils";
import { GetWikiPageCore } from "../server/getWikiPageCore";

export default resolver.pipe(
    resolver.authorize(Permission.view_wiki_pages),
    resolver.zod(ZTGetWikiPageArgs),
    async (args: TGetWikiPageArgs, ctx: AuthenticatedCtx) => {
        const ret = await GetWikiPageCore({
            canonicalWikiSlug: args.canonicalWikiPath,
            currentUserId: ctx.session.userId,
            clientBaseRevisionId: args.baseRevisionId,
            clientLockId: args.lockId,
            ctx: ctx,
            dbt: db
        });
        return ret;
    }
);



