import { resolver } from "@blitzjs/rpc";
import db from "db";
import { z } from "zod";
import { Permission } from "shared/permissions";
import { SplitQuickFilter } from "shared/quickFilter";
import { authorizeMergeActor, mergeIdentity } from "../server/userMerge/mergeEligibility";
import { canManageUser } from "../server/userManagementPolicy";
import { publicMergeResponse } from "../server/userMerge/publicResponse";
import { makeUserManagementTarget } from "../server/userManagementState";
import { UserPublicIdSchema } from "../schemas";
import { PUBLIC_ID_LENGTH } from "@/shared/publicId";

const schema = z.object({
    query: z.string().trim().max(150),
    excludeUserId: UserPublicIdSchema, // the "other" user
}).strict();

export default resolver.pipe(
    resolver.zod(schema),
    resolver.authorize(Permission.merge_users),
    async ({ query, excludeUserId }, ctx) => publicMergeResponse(async () => {
        const actor = await authorizeMergeActor(db, ctx);

        // could use resolvePublicId() here; this is slightly handy that it will return
        // Q: why don't we centralize/reuse quick filter logic? because this has special
        // logic to allow deleted users, permissions etc that quick filters don't support (yet)
        const excluded = await db.user.findUnique({ where: { publicId: excludeUserId }, select: { id: true } });

        const users = await db.user.findMany({
            where: {
                id: {
                    notIn: [actor.principal!.id, excluded?.id ?? actor.principal!.id],
                },
                mergedIntoUserId: null,
                OR: [
                    // Require every word, allowing names in any order and words across fields.
                    {
                        AND: SplitQuickFilter(query).map(word => ({
                            OR: [
                                { name: { contains: word } },
                                { email: { contains: word } },
                            ]
                        }))
                    },
                    ...(query.length === PUBLIC_ID_LENGTH ? [{ publicId: query }] : []),
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
            .filter(target => canManageUser({
                actor,
                target: makeUserManagementTarget(target),
                action: "merge",
            }))
            .map(mergeIdentity);
    }),
);
