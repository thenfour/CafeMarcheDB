import { BlitzPage, Routes } from "@blitzjs/next"
import { useRouter } from "next/router"
import { SignupForm } from "src/auth/components/SignupForm"
import { simulateLinkClick } from "src/core/components/CMCoreComponents2"
import DashboardLayout from "src/core/layouts/DashboardLayout"

const MainContent: BlitzPage = () => {
  const router = useRouter()

  return <SignupForm onSuccess={() => simulateLinkClick(Routes.Home())} />
}




const SignupPage: BlitzPage = () => {
  return (
    <DashboardLayout title="Signup" disableLoginRedirect>
      <MainContent />
    </DashboardLayout>
  )
}


export default SignupPage
