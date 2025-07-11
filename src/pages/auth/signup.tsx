import { BlitzPage, Routes } from "@blitzjs/next"
import { Suspense } from "react"
import { SignupForm } from "src/auth/components/SignupForm"
import { AppContextMarker } from "src/core/components/AppContext"
import { useRouter } from "next/router"
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout"

const MainContent: BlitzPage = () => {
  const router = useRouter()
  return <Suspense>
    <SignupForm onSuccess={() => router.push(Routes.Home())} />
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
