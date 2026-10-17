import { defineCmdbPage } from "src/route/cmdbPage";
import type { ComponentProps } from "react";
import Page from "../../backstage/wiki/[...slug]";

export { getServerSideProps } from "../../backstage/wiki/[...slug]";

function PlatformWikiPage(props: ComponentProps<typeof Page>) {
    return <Page {...props} />;
}

defineCmdbPage("platformWiki", PlatformWikiPage);
export default PlatformWikiPage;
