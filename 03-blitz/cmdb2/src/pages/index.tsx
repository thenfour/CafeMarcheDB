import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthenticatedSession, useAuthorizeIf } from "@blitzjs/auth";
import { CMDBRolesIsAuthorized, CMAuthorize } from "types";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";

const Home: BlitzPage = () => {
  return (
    <DashboardLayout title="Home">
      home page.
    </DashboardLayout>
  )
}

// authenticate only works when boolean.
// https://github.com/blitz-js/blitz/issues/4155
// Home.authenticate = true;// { role: [Permission.can_edit_users] };

export default Home;
