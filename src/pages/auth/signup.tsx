import { BlitzPage, Routes } from "@blitzjs/next"
import { Suspense } from "react"
import { SignupForm } from "src/auth/components/SignupForm"
import { AppContextMarker } from "src/core/components/AppContext"
import { simulateLinkClick } from "src/core/components/CMCoreComponents2"
import DashboardLayout from "src/core/layouts/DashboardLayout"

const MainContent: BlitzPage = () => {
  //const router = useRouter()
  return <Suspense>
    <SignupForm onSuccess={() => simulateLinkClick(Routes.Home())} />
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
