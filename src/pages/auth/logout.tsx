import { BlitzPage } from "@blitzjs/next";
import { useMutation } from "@blitzjs/rpc";
import { useRouter } from "next/router";
import { useEffect } from 'react';
import logout from "src/auth/mutations/logout";

const LogoutPage: BlitzPage = () => {
    const [logoutMutation] = useMutation(logout);
    const router = useRouter();

    // all this to avoid triggering current state stuff and getting unauthorized exceptions instead of a clean login option.
    useEffect(() => {
        logoutMutation().then(() => {
            window.setTimeout(() => {
                window.location.href = "/backstage";
            }, 0);
        }).catch((e) => {
            console.log(e);
        });
    }, []);

    return (<>logging you out...</>);
}

export default LogoutPage;
