import { useRouter } from "next/router"
import Layout from "src/core/layouts/Layout"
import { SignupForm } from "src/auth/components/SignupForm"
import { BlitzPage, Routes } from "@blitzjs/next"
import { useMutation } from "@blitzjs/rpc"
import stopImpersonating from "src/auth/mutations/stopImpersonating"
import { Button } from "@mui/material"
import { useSession } from "@blitzjs/auth"
import { Suspense } from "react"

const MainContent = () => {
    const session = useSession();
    const [stopImpersonatingMutation] = useMutation(stopImpersonating);

    const onClickStopImpersonating = async () => {
        await stopImpersonatingMutation();
    };

    if (session.impersonatingFromUserId == null) {
        return <>you are not impersonating</>;
    }

    return <>
        <div>Click to stop impersonating.</div>
        <Button onClick={onClickStopImpersonating}>stop impersonating</Button>
    </>;

};

const StopImpersonatingPage: BlitzPage = () => {

    return <Suspense>
        <MainContent />
    </Suspense>;
}

export default StopImpersonatingPage


