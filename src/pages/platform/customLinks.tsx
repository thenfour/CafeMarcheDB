import { defineCmdbPage } from "src/route/cmdbPage";
import Page from "../backstage/customLinks";

function PlatformCustomLinksPage() {
    return <Page />;
}

defineCmdbPage("platformCustomLinks", PlatformCustomLinksPage);
export default PlatformCustomLinksPage;
