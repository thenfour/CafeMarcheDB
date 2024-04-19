import { BlitzPage } from "@blitzjs/next";
import { Suspense } from "react";
import { Permission } from "shared/permissions";
import { useAuthorizationOrThrow } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import DashboardLayout from "src/core/layouts/DashboardLayout";

const MyContent = () => {

    useAuthorizationOrThrow("MarkdownHelpPage", Permission.basic_trust);

    return <div>
        <SettingMarkdown setting="MarkdownHelpPage" />
    </div>;
};



const MarkdownHelpPage: BlitzPage = () => {

    return (
        <DashboardLayout title="Markdown help">
            <Suspense fallback="Loading...">
                <MyContent />
            </Suspense>
        </DashboardLayout>
    );
}

export default MarkdownHelpPage;
