import type { Ctx } from "@blitzjs/next";
import { AuthorizationError, NotFoundError } from "blitz";
import { Permission } from "shared/permissions";
import type { MergeIdentity, UserMergeParticipants } from "../../userMergeSchemas";
import { requireFreshPermission } from "../permissionAuthorization";
import { canManageUser } from "../userManagementPolicy";
import { makeUserManagementActor, makeUserManagementTarget } from "../userManagementState";
import type { MergeContext, MergeDatabase, MergeUser } from "./types";
import { xRole } from "@/src/core/db3/db3";

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
        where: { id: { in: [participants.mainUserId, participants.retiringUserId] } },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
        orderBy: { id: "asc" },
    });
    const main = users.find(user => user.id === participants.mainUserId);
    const retiring = users.find(user => user.id === participants.retiringUserId);
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
    return { db, main, retiring, ...participants };
}

// converts a MergeUser object (straight from db) to a MergeIdentity object (merge context-facing)
export function mergeIdentity(user: MergeUser): MergeIdentity {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        roleId: user.role ? xRole.parseIdentity(user.role) : null,
        isDeleted: user.isDeleted,
        isSysAdmin: user.isSysAdmin,
    };
}
