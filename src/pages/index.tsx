import { defineCmdbPage } from "src/route/cmdbPage";
// site root.

import PlatformPublicIndex, { PlatformPublicIndexProps } from "../core/components/frontpage/PlatformPublicIndex";

function PublicIndex(props: PlatformPublicIndexProps) {
    return <PlatformPublicIndex {...props} />;
}

defineCmdbPage("root", PublicIndex);
export default PublicIndex;
