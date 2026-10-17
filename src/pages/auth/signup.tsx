import { defineCmdbPage } from "src/route/cmdbPage";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout"
import { useCmdbRouter } from "@/src/route/useCmdbRouter"
import { BlitzPage } from "@blitzjs/next"
import { Suspense } from "react"
import { SignupForm } from "src/auth/components/SignupForm"
import { AppContextMarker } from "src/core/components/AppContext"

const MainContent: BlitzPage = () => {
  const router = useCmdbRouter()
  return <Suspense>
    <SignupForm onSuccess={() => router.push(router.homeHref())} />
  </Suspense>;
}

const SignupPage: BlitzPage = () => {
  return (
    <DashboardLayout title="Signup" disableLoginRedirect>
      <AppContextMarker name="SignupPage">
        <MainContent />
      </AppContextMarker>
    </DashboardLayout>
  )
}

defineCmdbPage("auth_signup", SignupPage);
export default SignupPage;
