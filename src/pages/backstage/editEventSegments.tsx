import { defineCmdbPage } from "src/route/cmdbPage";
import React from "react";
import { DeferredDomainPage } from "src/core/components/DeferredDomainPage";

function RecoveryPage_editEventSegments() {
    return <DeferredDomainPage feature="eventWorkflows" />;
}

defineCmdbPage("bandEditEventSegments", RecoveryPage_editEventSegments);
export default RecoveryPage_editEventSegments;
