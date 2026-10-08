import React from "react";
import { useLocale } from "src/locale/components/useLocale";

export function EventCalendarRecoveryNotice() {
    const locale = useLocale();
    return <p role="status">{locale.getPlainString("recovery.eventWorkflows.calendarOverlay")}</p>;
}
