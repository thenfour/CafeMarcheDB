
import { useAuthenticatedSession } from "@blitzjs/auth";
import { Routes } from "@blitzjs/next";
import { useMutation } from "@blitzjs/rpc";
import { Button } from "@mui/material";
import { useRouter } from "next/router";
import impersonateUser from "src/auth/mutations/impersonateUser";

export const ImpersonateUserButton = ({ userId }: { userId: number }) => {
    const router = useRouter();
    const [impersonateUserMutation] = useMutation(impersonateUser);
    const session = useAuthenticatedSession();

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

    if (!session.isSysAdmin) return null;

    return (
        <Button onClick={handleImpersonateClick}>
            Impersonate
        </Button>
    );
}
