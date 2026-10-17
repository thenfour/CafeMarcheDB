import { defineCmdbPage } from "src/route/cmdbPage";
import React from "react";
import { DeferredDomainPage } from "src/core/components/DeferredDomainPage";

function RecoveryPage_editEvents() {
    return <DeferredDomainPage feature="eventWorkflows" />;
}

defineCmdbPage("bandEditEvents", RecoveryPage_editEvents);
export default RecoveryPage_editEvents;
