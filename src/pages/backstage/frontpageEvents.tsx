import { defineCmdbPage } from "src/route/cmdbPage";
import React from "react";
import { DeferredDomainPage } from "src/core/components/DeferredDomainPage";

function RecoveryPage_frontpageEvents() {
    return <DeferredDomainPage feature="eventWorkflows" />;
}

defineCmdbPage("bandFrontpageEvents", RecoveryPage_frontpageEvents);
export default RecoveryPage_frontpageEvents;
