import { resolver } from "@blitzjs/rpc";
import db from "db";
import { z } from "zod";
import { Permission } from "shared/permissions";
import { authorizeMergeActor, mergeIdentity } from "../server/userMerge/mergeEligibility";
import { canManageUser } from "../server/userManagementPolicy";
import { publicMergeResponse } from "../server/userMerge/publicResponse";
import { makeUserManagementTarget } from "../server/userManagementState";
import { UserPublicIdSchema } from "../schemas";
import { resolvePublicId } from "@/src/core/db3/server/db3PublicIds";
import { xUser } from "@/src/core/db3/db3";
import { PUBLIC_ID_LENGTH } from "@/shared/publicId";

const schema = z.object({
    query: z.string().trim().max(150),
    excludeUserId: UserPublicIdSchema, // the "other" user
}).strict();

export default resolver.pipe(
    resolver.zod(schema),
    resolver.authorize(Permission.merge_users),
    async ({ query, excludeUserId }, ctx) => publicMergeResponse(async () => {
        const actor = await authorizeMergeActor(db as any, ctx); // db as any to avoid typescript choking

        // could use resolvePublicId() here; this is slightly handy that it will return
        const excluded = await db.user.findUnique({ where: { publicId: excludeUserId }, select: { id: true } });

        const users = await db.user.findMany({
            where: {
                id: {
                    notIn: [actor.principal!.id, excluded?.id ?? actor.principal!.id],
                },
                mergedIntoUserId: null,
                OR: [
                    // TODO: could use ParseQuickFilter() and generate a better query.
                    { name: { contains: query } },
                    { email: { contains: query } },
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
