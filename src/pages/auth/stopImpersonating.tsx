import { useSession } from "@blitzjs/auth"
import { BlitzPage } from "@blitzjs/next"
import { useMutation } from "@blitzjs/rpc"
import { Button } from "@mui/material"
import { Suspense } from "react"
import stopImpersonating from "src/auth/mutations/stopImpersonating"

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


