import { type PromiseReturnType } from "blitz"
import Link from "next/link"
import { CMButton, CMButtonGroup } from "src/core/components/CMCoreComponents2"
import login from "src/auth/mutations/login"
import { Login } from "src/auth/schemas"
import { useMutation } from "@blitzjs/rpc"
import { useFeatureRecorder } from "@/src/core/components/dashboardContext/DashboardContext"
import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking"
import React from "react"
import { NameValuePair } from "src/core/components/CMCoreComponents2"
import { useSnackbar } from "src/core/components/SnackbarContext"

type LoginFormProps = {
  onSuccess?: (user: PromiseReturnType<typeof login>) => void
}

export const LoginForm = (props: LoginFormProps) => {
  const [loginMutation] = useMutation(login);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [validationErrors, setValidationErrors] = React.useState<{ email?: string; password?: string }>({});
  const { showMessage: showSnackbar } = useSnackbar();
  const recordFeature = useFeatureRecorder();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validationResult = Login.safeParse({ email, password });
    if (!validationResult.success) {
      const fieldErrors = validationResult.error.flatten().fieldErrors;
      setValidationErrors({
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      });
      return;
    }

    setValidationErrors({});
    try {
      void recordFeature({
        feature: ActivityFeature.login_email,
        context: "LoginForm",
      });
      const user = await loginMutation(validationResult.data);
      props.onSuccess?.(user)
    } catch (error: any) {
      console.log(error);
      showSnackbar({ severity: "error", children: "Sorry, we had an unexpected error. Please try again. - " + error.toString() });
    }
  };

  return (<div>
    <div className="link createNewAccount">
      Login using email & password
    </div>
    <form onSubmit={handleSubmit} method="">
      <NameValuePair
        isReadOnly={false}
        name={"Email"}
        validationError={validationErrors.email}
        value={<input type="text" placeholder="Email" value={email} aria-invalid={!!validationErrors.email} onChange={e => setEmail(e.target.value)} />}
      />
      <NameValuePair
        isReadOnly={false}
        name={"Password"}
        validationError={validationErrors.password}
        value={<input type="password" placeholder="password" value={password} aria-invalid={!!validationErrors.password} onChange={e => setPassword(e.target.value)} />}
      />
      <CMButtonGroup><CMButton type="submit" value="Login">Login</CMButton></CMButtonGroup>
      <Link href={"/auth/forgot-password"}>Forgot your password?</Link>
    </form>

  </div>);
}

export default LoginForm
