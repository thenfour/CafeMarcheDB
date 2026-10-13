
import { useMutation } from "@blitzjs/rpc";
import { useCmdbRouter } from "src/route/useCmdbRouter";
import { Permission } from "shared/permissions";
import impersonateUser from "src/auth/mutations/impersonateUser";
import type { UserPublicId } from "shared/publicId";
import { CMUserMgmtButton } from "../CMCoreComponents2";
import { useDashboardContext } from "../dashboardContext/DashboardContext";

export const ImpersonateUserButton = ({ userId }: { userId: UserPublicId }) => {
    const router = useCmdbRouter();
    const [impersonateUserMutation] = useMutation(impersonateUser);
    const dashboardContext = useDashboardContext();

    if (!dashboardContext.isAuthorized(Permission.impersonate_user)) {
        return null;
    }

    const handleImpersonateClick = () => {
        impersonateUserMutation({ userId })
            .then(() => {
                // navigate to home page
                void router.push("/backstage");
            })
            .catch((e) => {
                console.error(e);
            });
    };

    return (
        <CMUserMgmtButton onClick={handleImpersonateClick}>
            Impersonate
        </CMUserMgmtButton>
    );
}
