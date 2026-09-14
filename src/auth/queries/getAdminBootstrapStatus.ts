import { resolver } from "@blitzjs/rpc";
import db from "db";
import { Permission } from "shared/permissions";
import {
    getAdminBootstrapConfiguration,
    getAdminBootstrapTargetEmail,
} from "../server/adminBootstrap";
import { hasAdminBootstrapTokenBeenClaimed } from "../server/adminBootstrapClaims";
import { findSignInUser } from "../server/signInMethods";

export interface AdminBootstrapStatus {
    isEligible: boolean;
    isConfigured: boolean;
    isClaimable: boolean;
    isAlreadySysadmin: boolean;
}

const unavailableStatus: AdminBootstrapStatus = {
    isEligible: false,
    isConfigured: false,
    isClaimable: false,
    isAlreadySysadmin: false,
};

export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (_, ctx): Promise<AdminBootstrapStatus> => {
        const user = await db.user.findFirst({
            where: { id: ctx.session.userId },
            select: { id: true, isDeleted: true, isSysAdmin: true },
        });
        const targetEmail = getAdminBootstrapTargetEmail();
        if (!targetEmail) {
            return unavailableStatus;
        }
        const signInUser = await findSignInUser(db, { type: "email", identifier: targetEmail }, { allowInactive: false });
        if (!user || signInUser?.id !== user.id) {
            return unavailableStatus;
        }

        const configuration = getAdminBootstrapConfiguration();
        const previousClaim = configuration
            ? await hasAdminBootstrapTokenBeenClaimed(db, configuration.tokenHash)
            : false;

        return {
            isEligible: true,
            isConfigured: !!configuration,
            isClaimable: !!configuration && !previousClaim && !user.isSysAdmin,
            isAlreadySysadmin: user.isSysAdmin,
        };
    },
);
