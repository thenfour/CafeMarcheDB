import { BlitzPage } from "@blitzjs/next";
import { useMutation, useQuery } from "@blitzjs/rpc";
import { Button } from "@mui/material";
import Head from "next/head";
import React, { Suspense } from "react";
import claimAdminBootstrap from "src/auth/mutations/claimAdminBootstrap";
import getAdminBootstrapStatus, { type AdminBootstrapStatus } from "src/auth/queries/getAdminBootstrapStatus";
import { AppContextMarker } from "src/core/components/AppContext";
import { NameValuePair } from "src/core/components/CMCoreComponents2";
import { CMTextInputBase } from "src/core/components/CMTextField";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";

const RecoveryContent = ({ status }: { status: AdminBootstrapStatus }) => {
    const [claimMutation, mutationState] = useMutation(claimAdminBootstrap);
    const [secret, setSecret] = React.useState("");
    const [claimSucceeded, setClaimSucceeded] = React.useState(false);
    const [claimFailed, setClaimFailed] = React.useState(false);

    if (claimSucceeded || status.isAlreadySysadmin) {
        return <div className="signInBlock">
            <div className="title">System administration is available</div>
            <div className="description">This account has Sysadmin access.</div>
        </div>;
    }

    if (!status.isConfigured) {
        return <div className="signInBlock">
            <div className="title">Administrator recovery is unavailable</div>
            <div className="description">The deployment bootstrap credential is not configured.</div>
        </div>;
    }

    if (!status.isClaimable) {
        return <div className="signInBlock">
            <div className="title">Administrator recovery is unavailable</div>
            <div className="description">The configured bootstrap credential has already been claimed.</div>
        </div>;
    }

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setClaimFailed(false);
        try {
            await claimMutation({ secret });
            setSecret("");
            setClaimSucceeded(true);
        } catch {
            setClaimFailed(true);
        }
    };

    return <div className="signInBlock">
        <div className="title">Restore system administration</div>
        <div className="description">
            Enter the one-time bootstrap credential configured for this deployment.
        </div>
        <form onSubmit={handleSubmit}>
            <NameValuePair
                isReadOnly={mutationState.isLoading}
                name="Bootstrap credential"
                value={<CMTextInputBase
                    autoFocus
                    type="password"
                    value={secret}
                    onChange={(_, value) => setSecret(value)}
                />}
            />
            <Button type="submit" disabled={mutationState.isLoading || secret.length === 0}>
                Restore Sysadmin access
            </Button>
            {claimFailed && <div className="error">
                Administrator recovery is unavailable or the supplied credential is invalid.
            </div>}
        </form>
    </div>;
};

const EligibleAdminBootstrapPage = () => {
    const [status] = useQuery(getAdminBootstrapStatus, null);
    if (!status.isEligible) return null;

    return <DashboardLayout title="Administrator recovery">
        <AppContextMarker name="AdminBootstrapPage">
            <RecoveryContent status={status} />
        </AppContextMarker>
    </DashboardLayout>;
};

const AdminBootstrapPage: BlitzPage = () => <>
    <Head><meta name="robots" content="noindex,nofollow" /></Head>
    <Suspense>
        <EligibleAdminBootstrapPage />
    </Suspense>
</>;

export default AdminBootstrapPage;
