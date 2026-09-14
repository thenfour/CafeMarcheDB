import { resolver } from "@blitzjs/rpc";
import db from "db";
import { z } from "zod";
import { Permission } from "shared/permissions";
import { authorizeMergeActor, mergeIdentity } from "../server/userMerge/mergeEligibility";
import { canManageUser } from "../server/userManagementPolicy";
import { publicMergeResponse } from "../server/userMerge/publicResponse";

export default resolver.pipe(
    resolver.zod(z.object({ query: z.string().trim().max(150), excludeUserId: z.number().int().positive() }).strict()),
    resolver.authorize(Permission.merge_users),
    async ({ query, excludeUserId }, ctx) => publicMergeResponse(async () => {
        const actor = await authorizeMergeActor(db as any, ctx); // db as any to avoid typescript choking
        const users = await db.user.findMany({
            where: {
                id: {
                    notIn: [actor.id, excludeUserId],
                },
                mergedIntoUserId: null,
                OR: [
                    // TODO: could use ParseQuickFilter() and generate a better query.
                    { name: { contains: query } },
                    { email: { contains: query } },
                    ...(/^\d+$/.test(query) ? [{ id: Number(query) }] : []),
                ],
            },
            include:
            {
                role:
                {
                    include:
                    {
                        permissions: {
                            include: { permission: true }
                        }
                    }
                },
            },
            orderBy: [
                { name: "asc" },
                { id: "asc" },
            ],
            take: 100,
        });

        return users
            .filter(target => canManageUser({ actor, target, action: "merge" }))
            .map(mergeIdentity);
    }),
);
