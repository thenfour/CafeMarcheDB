import { resolver } from "@blitzjs/rpc";
import db from "db";
import { Permission } from "shared/permissions";
import { NullableHydrateUserWithRoles, UserWithRolesArgs } from "src/core/db3/shared/schema/userPayloads";
import {
    getAdminBootstrapConfiguration,
} from "../server/adminBootstrap";
import { hasAdminBootstrapTokenBeenClaimed } from "../server/adminBootstrapClaims";
import { cmauthorize } from "../server/cmResolver";
import { makePermissionSetFromRole } from "../server/userManagementState";

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
    cmauthorize({ permission: Permission.login, requireUser: true }),
    async (_, ctx): Promise<AdminBootstrapStatus> => {

        const user = NullableHydrateUserWithRoles(await db.user.findFirst({
            where: { id: ctx.session.userId },
            ...UserWithRolesArgs,
        }));
        if (!user || user.isDeleted) {
            return unavailableStatus;
        }

        const configuration = getAdminBootstrapConfiguration();

        // making the claim one-time-use is an effective shutdown mechanism.
        // but for DEV environment, bypass that check for simplicity.
        const blockedByPreviousClaim = configuration?.oneTimeUse ? await hasAdminBootstrapTokenBeenClaimed(db, configuration.tokenHash) : false;
        const isAlreadySysadmin = makePermissionSetFromRole(user.globalRole).includesName(Permission.sysadmin);
        const ret = {
            isEligible: true,
            isConfigured: !!configuration,
            isClaimable: !!configuration && !blockedByPreviousClaim && !isAlreadySysadmin,
            isAlreadySysadmin,
        };

        return ret;
    },
);
