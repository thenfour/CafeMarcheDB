import { defineCmdbPage } from "src/route/cmdbPage";
import React from "react";
import { DeferredDomainPage } from "src/core/components/DeferredDomainPage";

function RecoveryPage_editSongs() {
    return <DeferredDomainPage feature="songWorkflows" />;
}

defineCmdbPage("bandEditSongs", RecoveryPage_editSongs);
export default RecoveryPage_editSongs;
