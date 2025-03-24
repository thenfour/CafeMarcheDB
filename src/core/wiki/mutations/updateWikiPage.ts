// updateWikiPage
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/utils";
import { TUpdateWikiPageArgs, wikiParseCanonicalWikiPath, ZTUpdateWikiPageArgs } from "src/core/wiki/shared/wikiUtils";
import * as mutationCore from "src/core/db3/server/db3mutationCore";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.edit_wiki_pages),
    resolver.zod(ZTUpdateWikiPageArgs),
    async ({ slug, name, content, visiblePermissionId }: TUpdateWikiPageArgs, ctx: AuthenticatedCtx) => {

        const changeContext = CreateChangeContext("updateWikiPage");

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
                    createdByUserId: currentUser.id,
                    wikiPageId: wikiPage.id,
                }
            });

            await db.wikiPage.update({
                where: { id: wikiPage.id },
                data: {
                    currentRevisionId: revision.id,
                },
            });

            if (visiblePermissionId) {
                await db.wikiPage.update({
                    where: { id: wikiPage.id },
                    data: {
                        visiblePermissionId,
                    },
                });
            }

            await RegisterChange({
                action: ChangeAction.insert,
                ctx,
                changeContext,
                pkid: revision.id,
                table: "wikiPageRevision",
                newValues: revision,
            });

            return revision;
        } else {
            // Page doesn't exist, create page and revision
            const wikiPath = wikiParseCanonicalWikiPath(slug);
            const newWikiPage = await db.wikiPage.create({
                data: {
                    slug,
                    namespace: wikiPath.namespace,
                    visiblePermissionId,
                },
            });

            const revision = await db.wikiPageRevision.create({
                data: {
                    name,
                    content,
                    createdByUserId: currentUser.id,
                    wikiPageId: newWikiPage.id,
                }
            });

            await db.wikiPage.update({
                where: { id: newWikiPage.id },
                data: {
                    currentRevisionId: revision.id,
                },
            });

            await RegisterChange({
                action: ChangeAction.insert,
                ctx,
                changeContext,
                pkid: revision.id,
                table: "wikiPageRevision",
                newValues: revision,
            });

            return revision;
        }
    }
);

