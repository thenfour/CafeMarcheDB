import { BlitzPage } from "@blitzjs/next";
import { useMutation } from "@blitzjs/rpc";
import { useRouter } from "next/router";
import { useEffect } from 'react';
import logout from "src/auth/mutations/logout";

const LogoutPage: BlitzPage = () => {
    const [logoutMutation] = useMutation(logout);
    const router = useRouter();

    useEffect(() => {
        logoutMutation().then(() => {
            router.push('/backstage');
        }).catch((e) => {
            console.log(e);
        });
    }, []);

    return (<>logging you out...</>);
}

export default LogoutPage;
