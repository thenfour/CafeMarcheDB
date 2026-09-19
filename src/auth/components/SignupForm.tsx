import { useFeatureRecorder } from "@/src/core/components/dashboardContext/DashboardContext";
import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
import { useSnackbar } from "@/src/core/components/SnackbarContext";
import { useMutation } from "@blitzjs/rpc";
import React from "react";
import signup from "src/auth/mutations/signup";
import { Signup } from "src/auth/schemas";
import { CMButton, NameValuePair } from "src/core/components/CMCoreComponents2";

type SignupFormProps = {
  onSuccess?: () => void
}

export const SignupForm = (props: SignupFormProps) => {
  const [signupMutation] = useMutation(signup)
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [validationErrors, setValidationErrors] = React.useState<{ name?: string; email?: string; password?: string }>({});
  const { showMessage: showSnackbar } = useSnackbar();
  const recordFeature = useFeatureRecorder();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validationResult = Signup.safeParse({ name, email, password });
    if (!validationResult.success) {
      const fieldErrors = validationResult.error.flatten().fieldErrors;
      setValidationErrors({
        name: fieldErrors.name?.[0],
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      });
      return;
    }

    setValidationErrors({});
    setIsSubmitting(true);
    void recordFeature({
      feature: ActivityFeature.signup_email,
    });
    try {
      await signupMutation(validationResult.data);
      props.onSuccess?.();
    } catch (error: any) {
      console.log(error);
      // P2002 = "Unique constraint failed on the {constraint}"
      if (error.code === "P2002" && error.meta?.target?.includes("email")) {
        showSnackbar({ severity: "error", children: "This email is already being used" });
      } else {
        showSnackbar({ severity: "error", children: "Sorry, we had an unexpected error. Please try again. - " + error.toString() });
      }
      // only allow resubmission upon error. upon success it would make no sense to re-signin.
      setIsSubmitting(false);
    }
  };

  return (<div className={`signInBlock ${isSubmitting ? "disabled" : ""}`}>
    <div className="title">Create an Account</div>
    <div className="description">
      Anyone can create an account, but you'll start with limited permissions. An admin will need to grant you elevated permissions after you create your account.
    </div>
    <form onSubmit={handleSubmit} method="">

      <NameValuePair
        isReadOnly={false}
        name={"Full name"}
        validationError={validationErrors.name}
        value={<input type="text" placeholder="full name" value={name} aria-invalid={!!validationErrors.name} onChange={e => setName(e.target.value)} />}
      />

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
      <div><CMButton type="submit" value="Submit" enabled={!isSubmitting}>Submit</CMButton></div>
    </form>
  </div>);
}

export default SignupForm
