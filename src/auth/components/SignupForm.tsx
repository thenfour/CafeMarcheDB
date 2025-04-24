//import { LabeledTextField } from "src/core/components/LabeledTextField"
//import { Form, FORM_ERROR } from "src/core/components/Form"
import { useMutation } from "@blitzjs/rpc";
import React from "react";
import signup from "src/auth/mutations/signup";
import { NameValuePair } from "src/core/components/CMCoreComponents2";
import { useFeatureRecorder } from "src/core/components/DashboardContext";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";

type SignupFormProps = {
  onSuccess?: () => void
}

export const SignupForm = (props: SignupFormProps) => {
  const [signupMutation] = useMutation(signup)
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
  const recordFeature = useFeatureRecorder();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setIsSubmitting(true);
    void recordFeature({
      feature: ActivityFeature.signup_email,
    });
    e.preventDefault();
    try {
      await signupMutation({
        email,
        password,
        name,
      });
      props.onSuccess?.();
    } catch (error: any) {
      console.log(error);
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
        value={<input type="text" placeholder="full name" value={name} onChange={e => setName(e.target.value)} />}
      />

      <NameValuePair
        isReadOnly={false}
        name={"Email"}
        value={<input type="text" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />}
      />

      <NameValuePair
        isReadOnly={false}
        name={"Password"}
        value={<input type="password" placeholder="password" value={password} onChange={e => setPassword(e.target.value)} />}
      />
      <div><input type="submit" value="Submit" disabled={isSubmitting} /></div>
    </form>
  </div>);
}

export default SignupForm
