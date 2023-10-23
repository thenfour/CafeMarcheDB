import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import { AuthenticatedMiddlewareCtx, Ctx } from "blitz";
import { CMDBAuthorizeOrThrow } from "types";
import { HomepageContentSpec } from "../shared/apiTypes";

export default resolver.pipe(
    async (input: {}, ctx: Ctx) => {
        const ret: HomepageContentSpec = {
            agenda: [{
                title: "*lol* an item"
            }, {
                title: "aoenuhoentuh"
            }],
            gallery: [{
                descriptionMarkdown: "a photo",
                uri: "/images/card.jpg",
            }],
        };

        return ret;
    }
);



