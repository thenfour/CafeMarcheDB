import { defineCmdbPage } from "src/route/cmdbPage";
import Page from "../backstage/featureReports";

function PlatformFeatureReportsPage() {
    return <Page />;
}

defineCmdbPage("platformFeatureReports", PlatformFeatureReportsPage);
export default PlatformFeatureReportsPage;
