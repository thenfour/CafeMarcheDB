import { BlitzPage } from "@blitzjs/next"
import { Suspense } from "react"
import { SignupForm } from "src/auth/components/SignupForm"
import { AppContextMarker } from "src/core/components/AppContext"
import { useCmdbRouter } from "src/route/useCmdbRouter";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout"

const MainContent: BlitzPage = () => {
  const router = useCmdbRouter()
  return <Suspense>
    <SignupForm onSuccess={() => router.push("/backstage")} />
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

export default SignupPage
