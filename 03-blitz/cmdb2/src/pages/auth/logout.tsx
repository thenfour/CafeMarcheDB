import { BlitzPage } from "@blitzjs/next";
import { useMutation } from "@blitzjs/rpc";
import { useEffect } from 'react';
import logout from "src/auth/mutations/logout";

const LogoutPage: BlitzPage = () => {
    const [logoutMutation] = useMutation(logout);

    useEffect(() => {
        const fn = async () => {
            await logoutMutation();
        };
        void fn();
    }, []);

    return (<>logging you out...</>
    )
}

export default LogoutPage;
