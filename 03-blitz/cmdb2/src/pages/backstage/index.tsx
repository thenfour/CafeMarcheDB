import { BlitzPage } from "@blitzjs/next";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import React, { FC, Suspense } from "react"

const Home: BlitzPage = () => {
  const [txt, setTxt] = React.useState("");
  return (
    <DashboardLayout title="Home">
      <SettingMarkdown settingName="root_markdown"></SettingMarkdown>

    </DashboardLayout>
  )
}

// authenticate only works when boolean.
// https://github.com/blitz-js/blitz/issues/4155
// Home.authenticate = true;// { role: [Permission.can_edit_users] };

export default Home;