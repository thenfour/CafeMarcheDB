
import { Routes } from "@blitzjs/next";
import { useMutation } from "@blitzjs/rpc";
import { useRouter } from "next/router";
import { Permission } from "shared/permissions";
import impersonateUser from "src/auth/mutations/impersonateUser";
import type { UserPublicId } from "shared/publicId";
import { CMUserMgmtButton } from "../CMCoreComponents2";
import { useDashboardContext } from "../dashboardContext/DashboardContext";

export const ImpersonateUserButton = ({ userId }: { userId: UserPublicId }) => {
    const router = useRouter();
    const [impersonateUserMutation] = useMutation(impersonateUser);
    const dashboardContext = useDashboardContext();

    if (!dashboardContext.isAuthorized(Permission.impersonate_user)) {
        return null;
    }

    const handleImpersonateClick = () => {
        impersonateUserMutation({ userId })
            .then(() => {
                // navigate to home page
                void router.push(Routes.Home());
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
