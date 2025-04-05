// based off the structure/logic of getEventFilterInfo

import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { Permission } from "shared/permissions";
import { TGetWikiPageArgs, ZTGetWikiPageArgs } from "src/core/wiki/shared/wikiUtils";
import { GetWikiPageCore } from "../server/getWikiPageCore";
import db from "db";
import { GetSearchResultsCore } from "src/core/db3/server/searchServerCore";
import { GetSearchResultsInput } from "src/core/db3/shared/apiTypes";

export default resolver.pipe(
    resolver.authorize(Permission.view_wiki_pages),
    resolver.zod(ZTGetWikiPageArgs),
    async (args: TGetWikiPageArgs, ctx: AuthenticatedCtx) => {
        // use search core
        // const si: GetSearchResultsInput = {

        // };
        // const result = await GetSearchResultsCore(si, ctx);
        // return ret;
    }
);



