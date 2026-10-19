import type { PermissionRequirement } from "src/auth/shared/permissionRequirement";
import type { SessionContext } from "@blitzjs/auth";
import type { BandPublicId } from "shared/publicId";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { bindDB3ReadSnapshot, type DB3ReadContext } from "src/core/db3/server/db3ReadExecution";
import { wikiTransaction } from "./wikiTransaction";

export function requireWikiAccess(context: DB3ReadContext, permission: PermissionRequirement) {
    const auth = context.authorization.requireUser();
    auth.requireBand();
    auth.requirePermission(permission);
    return auth;
}

/** Refresh membership and grants inside each retry, alongside the lock/content decision. */
export async function writeWiki<T>(
    session: SessionContext,
    bandPublicId: BandPublicId,
    permission: PermissionRequirement,
    work: (context: DB3ReadContext) => Promise<T>): Promise<T> //
{
    const auth = await loadAuthorization(session, bandPublicId);
    return wikiTransaction(async transaction => {
        const context = await bindDB3ReadSnapshot(transaction, auth, { isolationLevel: "Serializable" });
        requireWikiAccess(context, permission);
        return work(context);
    });
}
