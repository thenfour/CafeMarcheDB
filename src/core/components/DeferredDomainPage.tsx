import React from "react";
import { Alert } from "@mui/material";
import DashboardLayout from "./dashboard/DashboardLayout";
import { useLocale } from "src/locale/components/useLocale";

type DeferredPageFeature = "eventWorkflows" | "developerExamples";

/** Reachable URLs retain their route permissions without mounting unfinished readers. */
export function DeferredDomainPage({ feature }: { feature: DeferredPageFeature }) {
    const locale = useLocale();
    return <DashboardLayout title={feature}>
        <Alert severity="info">{feature}</Alert>
    </DashboardLayout>;
}
