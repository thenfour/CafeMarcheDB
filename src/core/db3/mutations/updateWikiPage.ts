// updateWikiPage
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { TUpdateWikiPageArgs, ZTUpdateWikiPageArgs } from "../shared/apiTypes";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.edit_wiki_pages),
    resolver.zod(ZTUpdateWikiPageArgs),
    async ({ slug, name, content, visiblePermissionId }: TUpdateWikiPageArgs, ctx: AuthenticatedCtx) => {

        const wikiPage = await db.wikiPage.findUnique({
            where: { slug },
        })

        const currentUser = (await mutationCore.getCurrentUserCore(ctx))!;

        if (wikiPage) {
            // Page exists, add new revision
            const revision = await db.wikiPageRevision.create({
                data: {
                    name,
                    content,
                    wikiPageId: wikiPage.id,
                    createdByUserId: currentUser.id,
                },
            })

            if (visiblePermissionId) {
                await db.wikiPage.update({
                    where: { id: wikiPage.id },
                    data: {
                        visiblePermissionId,
                    },
                });
            }

            return revision;
        } else {
            // Page doesn't exist, create page and revision
            const newWikiPage = await db.wikiPage.create({
                data: {
                    slug,
                    revisions: {
                        create: {
                            name,
                            content,
                            createdByUserId: currentUser.id,
                        },
                    },
                    visiblePermissionId,
                },
                include: {
                    revisions: true,
                    visiblePermission: true,
                },
            })

            return newWikiPage.revisions[0];
        }
    }
);

