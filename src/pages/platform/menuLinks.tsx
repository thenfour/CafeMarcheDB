import { defineCmdbPage } from "src/route/cmdbPage";
import Page from "../backstage/menuLinks";

function PlatformMenuLinksPage() {
    return <Page />;
}

defineCmdbPage("platformMenuLinks", PlatformMenuLinksPage);
export default PlatformMenuLinksPage;
