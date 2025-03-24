// based off the structure/logic of getEventFilterInfo

import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { Permission } from "shared/permissions";
import { TGetWikiPageArgs } from "src/core/db3/shared/wikiUtils";
import { GetWikiPageCore } from "../server/getWikiPageCore";

export default resolver.pipe(
    resolver.authorize(Permission.view_wiki_pages),
    async (args: TGetWikiPageArgs, ctx: AuthenticatedCtx) => {
        const ret = await GetWikiPageCore({ slug: args.slug });
        return ret;
    }
);



