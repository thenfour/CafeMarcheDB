import { defineCmdbPage } from "src/route/cmdbPage";
import type { ComponentProps } from "react";
import Page from "../../backstage/user/[...id_slug_tab]";

export { getServerSideProps } from "../../backstage/user/[...id_slug_tab]";

function PlatformUserPage(props: ComponentProps<typeof Page>) {
    return <Page {...props} />;
}

defineCmdbPage("platformUser", PlatformUserPage);
export default PlatformUserPage;
