import { resolver } from "@blitzjs/rpc";
import db from "db";
import { Permission } from "shared/permissions";
import {
    getAdminBootstrapConfiguration,
} from "../server/adminBootstrap";
import { hasAdminBootstrapTokenBeenClaimed } from "../server/adminBootstrapClaims";

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
        if (!user || user.isDeleted) {
            return unavailableStatus;
        }

        const configuration = getAdminBootstrapConfiguration();

        // making the claim one-time-use is an effective shutdown mechanism.
        // but for DEV environment, bypass that check for simplicity.
        const blockedByPreviousClaim = configuration?.oneTimeUse ? await hasAdminBootstrapTokenBeenClaimed(db, configuration.tokenHash) : false;
        const ret = {
            isEligible: true,
            isConfigured: !!configuration,
            isClaimable: !!configuration && !blockedByPreviousClaim && !user.isSysAdmin,
            isAlreadySysadmin: user.isSysAdmin,
        };

        return ret;
    },
);
