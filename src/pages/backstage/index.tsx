import type { BlitzPage } from "@blitzjs/next";
import { Alert, Stack } from "@mui/material";
import { CMLink } from "src/core/components/CMLink";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import { withMemberPresentation } from "src/core/components/user/bandMemberLinks";
import { useLocale } from "src/locale/components/useLocale";
import { LocalizedMarkdown } from "src/setting/client/components/SettingMarkdown";

function HomeContent() {
  const dashboard = useDashboardContext();
  const locale = useLocale();
  const member = dashboard.currentMembership;
  return <Stack spacing={2}>
      {!dashboard.memberPresentation.bandPublicId && <Alert severity="info">{locale.getPlainString("dashboard.band.required")}</Alert>}
      {member && member.bandUserInstruments.length === 0 && <Alert severity="info">
        {locale.getPlainString("dashboard.instruments.missing")}{" "}
        <CMLink href={withMemberPresentation("/backstage/profile", dashboard.memberPresentation)}>{locale.getPlainString("dashboard.profile")}</CMLink>
      </Alert>}
      <LocalizedMarkdown setting="BackstageFrontpageHeaderMarkdown" />
      <Alert severity="info">{locale.getPlainString("dashboard.deferred")}</Alert>
      <LocalizedMarkdown setting="BackstageFrontpageMarkdown" />
    </Stack>;
}

const Home: BlitzPage = () => {
  const locale = useLocale();
  return <DashboardLayout title={locale.getPlainString("dashboard.title")}><HomeContent /></DashboardLayout>;
};

export default Home;
