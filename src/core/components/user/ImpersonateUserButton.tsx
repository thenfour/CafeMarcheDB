
import { Routes } from "@blitzjs/next";
import { useMutation } from "@blitzjs/rpc";
import { Button } from "@mui/material";
import { useRouter } from "next/router";
import impersonateUser from "src/auth/mutations/impersonateUser";
import { Permission } from "shared/permissions";
import { useDashboardContext } from "../dashboardContext/DashboardContext";

export const ImpersonateUserButton = ({ userId }: { userId: number }) => {
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
        <Button onClick={handleImpersonateClick}>
            Impersonate
        </Button>
    );
}
