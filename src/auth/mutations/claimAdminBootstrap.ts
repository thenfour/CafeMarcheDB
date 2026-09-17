import { resolver } from "@blitzjs/rpc";
import { AuthorizationError } from "blitz";
import db, { Prisma } from "db";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";
import { Permission } from "shared/permissions";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import {
    UserWithRolesArgs,
    type UserWithRolesPayload,
} from "src/core/db3/shared/schema/userPayloads";
import { createPublicDataFromDatabase } from "../server/effectivePermissions";
import { z } from "zod";
import { findSignInUser } from "../server/signInMethods";
import {
    adminBootstrapSecretMatches,
    getAdminBootstrapConfiguration,
    kMinimumAdminBootstrapSecretLength,
} from "../server/adminBootstrap";
import {
    hasAdminBootstrapTokenBeenClaimed,
    recordAdminBootstrapTokenClaim,
} from "../server/adminBootstrapClaims";

export const ClaimAdminBootstrapInput = z.object({
    secret: z.string().min(kMinimumAdminBootstrapSecretLength).max(4096),
});

export class AdminBootstrapClaimError extends AuthorizationError {
    constructor() {
        super();
        this.message = "Administrator bootstrap is unavailable or the supplied credential is invalid.";
        this.name = "AdminBootstrapClaimError";
    }
}

const failClaim = (): never => {
    throw new AdminBootstrapClaimError();
};

export default resolver.pipe(
    resolver.zod(ClaimAdminBootstrapInput),
    resolver.authorize(Permission.login),
    async ({ secret }, ctx) => {
        const configuration = getAdminBootstrapConfiguration();
        if (!configuration) throw new AdminBootstrapClaimError();
        const verifiedConfiguration = configuration;

        let promotedUser: UserWithRolesPayload;
        try {
            promotedUser = await db.$transaction(async (tx: TransactionalPrismaClient) => {
                const user = await tx.user.findFirst({
                    ...UserWithRolesArgs,
                    where: { id: ctx.session.userId },
                });

                const signInUser = await findSignInUser(tx, { type: "email", identifier: verifiedConfiguration.email }, { allowInactive: false });

                if (
                    !user
                    || user.isSysAdmin
                    || signInUser?.id !== user.id
                ) {
                    failClaim();
                }
                if (!adminBootstrapSecretMatches(secret, verifiedConfiguration)) failClaim();

                const previousClaim = await hasAdminBootstrapTokenBeenClaimed(
                    tx,
                    verifiedConfiguration.tokenHash,
                );
                if (previousClaim) failClaim();

                const recordedClaim = await recordAdminBootstrapTokenClaim(
                    tx,
                    verifiedConfiguration.tokenHash,
                    user.id,
                );
                if (!recordedClaim) failClaim();

                const sysadminRoles = await tx.role.findMany({
                    where: { isSysAdminRole: true },
                    select: {
                        id: true,
                    },
                });
                if (sysadminRoles.length !== 1) failClaim();

                const updatedUser = await tx.user.update({
                    ...UserWithRolesArgs,
                    where: { id: user.id },
                    data: {
                        isSysAdmin: true,
                        roleId: sysadminRoles[0].id,
                    },
                });

                await tx.session.deleteMany({ where: { userId: user.id } });

                await RegisterChange({
                    action: ChangeAction.update,
                    changeContext: CreateChangeContext("claimAdminBootstrap"),
                    table: "User",
                    pkid: user.id,
                    oldValues: { isSysAdmin: false },
                    newValues: { isSysAdmin: true },
                    ctx,
                    db: tx,
                });

                return updatedUser;
            }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        } catch (error) {
            if (
                error instanceof AdminBootstrapClaimError
                || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
            ) {
                failClaim();
            }
            throw error;
        }

        await ctx.session.$create(await createPublicDataFromDatabase(db, { user: promotedUser }));
        return { userId: promotedUser.id, isSysAdmin: true };
    },
);
