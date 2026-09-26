import type { Ctx } from "@blitzjs/next";
import { AuthorizationError, NotFoundError } from "blitz";
import { Permission } from "shared/permissions";
import type { MergeIdentity, UserMergeParticipants } from "../../userMergeSchemas";
import { requireFreshPermission } from "../permissionAuthorization";
import { canManageUser } from "../userManagementPolicy";
import { makeUserManagementActor, makeUserManagementTarget } from "../userManagementState";
import type { MergeContext, MergeDatabase, MergeUser } from "./types";
import { xRole, xUser } from "@/src/core/db3/db3";

export async function authorizeMergeActor(db: MergeDatabase, ctx: Ctx) {
    // Disallow impersonated users from performing a merge. a bit arbitrary...
    if (ctx.session.$publicData.impersonatingFromUserId != null) {
        throw new AuthorizationError();
    }
    const actor = await requireFreshPermission(db, ctx.session.userId, Permission.merge_users);
    return makeUserManagementActor(actor, actor.effectivePermissions);
}

// also does auth check
export async function loadMergeContext(db: MergeDatabase, ctx: Ctx, participants: UserMergeParticipants): Promise<MergeContext> {
    const actor = await authorizeMergeActor(db, ctx);
    if (participants.mainUserId === participants.retiringUserId) {
        throw new Error("Choose two different accounts.");
    }
    const users = await db.user.findMany({
        where: { publicId: { in: [participants.mainUserId, participants.retiringUserId] } },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
        orderBy: { id: "asc" },
    });
    const main = users.find(user => user.publicId === participants.mainUserId);
    const retiring = users.find(user => user.publicId === participants.retiringUserId);
    if (!main || !retiring) throw new NotFoundError();
    for (const target of [main, retiring]) {
        if (!canManageUser({
            actor,
            target: makeUserManagementTarget(target),
            action: "merge",
        })) {
            throw new AuthorizationError();
        }
    }
    return { db, main, retiring, mainUserId: main.id, retiringUserId: retiring.id };
}

// converts a MergeUser object (straight from db) to a MergeIdentity object (merge context-facing)
export function mergeIdentity(user: MergeUser): MergeIdentity {
    return {
        publicId: xUser.parseIdentity(user.publicId),
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        roleId: user.role ? xRole.parseIdentity(user.role) : null,
        isDeleted: user.isDeleted,
        isSysAdmin: user.isSysAdmin,
    };
}
