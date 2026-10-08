import { Alert } from "@mui/material";
import React from "react";
import { useLocale } from "src/locale/components/useLocale";

export function QuickSearchRecoveryNotice() {
    const locale = useLocale();
    return <Alert severity="info">{locale.getPlainString("recovery.quickSearch.description")}</Alert>;
}
