import { Alert, Tooltip } from "@mui/material";
import React from "react";
import { useLocale } from "src/locale/components/useLocale";
import { CMButton } from "../CMCoreComponents2";

export function DeferredFileCreationNotice() {
    const locale = useLocale();
    return <Alert severity="info">{locale.getPlainString("recovery.fileCreation.description")}</Alert>;
}

/** Explain the disabled bake action without mounting its mutation hook. */
export function DeferredImageCreationButton() {
    const locale = useLocale();
    return <Tooltip title={locale.getPlainString("recovery.fileCreation.description")}>
        <span>
            <CMButton disabled>{locale.getPlainString("recovery.fileCreation.bake")}</CMButton>
        </span>
    </Tooltip>;
}
