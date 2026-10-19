import type { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { LoginSignup } from "src/core/components/LoginSignupForm";
import { defineCmdbPage } from "src/route/cmdbPage";

const LoginPage: BlitzPage = () => {
  return (
    <DashboardLayout title="Login" disableLoginRedirect>
      <LoginSignup />
    </DashboardLayout>
  );
};

defineCmdbPage("auth_login", LoginPage);
export default LoginPage;
