import { BlitzPage } from "@blitzjs/next";
import { EventDashboard } from "src/core/components/EventComponents";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import React, { Suspense } from "react";

const DynamicContent = () => {

  return (<Suspense>
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
