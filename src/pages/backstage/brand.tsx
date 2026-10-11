import type { BlitzPage } from "@blitzjs/next";
import React from "react";
import { CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { useLocale } from "src/locale/components/useLocale";
import { RegisteredSettingsEditor } from "src/setting/client/components/RegisteredSettingsEditor";
import { renderBrandingAssetDraftTools } from "src/setting/client/components/BrandingAssetDraftTools";

const BrandPage: BlitzPage = () => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("settings.brandTitle")}>
        <CMSinglePageSurfaceCard>
            <div className="content muiCompatible">
                <p>{locale.getPlainString("settings.brandRestriction")}</p>
                <RegisteredSettingsEditor hive="band" renderDraftTools={renderBrandingAssetDraftTools} />
            </div>
        </CMSinglePageSurfaceCard>
    </DashboardLayout>;
};

export default BrandPage;
