import { BlitzPage } from "@blitzjs/next";
import { EventDashboard } from "src/core/components/EventComponents";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import React, { Suspense } from "react";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { gIconMap } from "src/core/db3/components/IconSelectDialog";
import { useRouter } from "next/router";





const DynamicContent = () => {

  const [user] = useCurrentUser();
  let noInstrumentsWarning = (user?.instruments?.length || 0) < 1;

  return (<Suspense>
    <SettingMarkdown setting="BackstageFrontpageMarkdown" />
    {noInstrumentsWarning && <CMSinglePageSurfaceCard className="noInstrumentsWarning">
      <div>{gIconMap.ErrorOutline()}</div>
      <div>You have no instruments assigned; please go to
        &nbsp;<a href="/backstage/profile">your profile</a>&nbsp;
        and specify your instruments.
      </div>
    </CMSinglePageSurfaceCard>}
    <EventDashboard />
  </Suspense>
  )
};

const Home: BlitzPage = () => {
  return (
    <DashboardLayout title="Home">
      <DynamicContent />
    </DashboardLayout>
  )
}

export default Home;
