//import { LabeledTextField } from "src/core/components/LabeledTextField"
//import { Form, FORM_ERROR } from "src/core/components/Form"
import signup from "src/auth/mutations/signup"
import { Signup } from "src/auth/schemas"
import { useMutation } from "@blitzjs/rpc"
import React, { Suspense } from "react";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { FormControlLabel } from "@mui/material";
import { NameValuePair } from "src/core/components/CMCoreComponents2";

type SignupFormProps = {
  onSuccess?: () => void
}

export const SignupForm = (props: SignupFormProps) => {
  const [signupMutation] = useMutation(signup)
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await signupMutation({
        email,
        password,
        name,
      });
      props.onSuccess?.()
    } catch (error: any) {
      console.log(error);
      if (error.code === "P2002" && error.meta?.target?.includes("email")) {
        showSnackbar({ severity: "error", children: "This email is already being used" });
      } else {
        showSnackbar({ severity: "error", children: "Sorry, we had an unexpected error. Please try again. - " + error.toString() });
      }
    }
  };

  return (<div className="signInBlock">
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
      <div><input type="submit" value="Submit" /></div>
    </form>
  </div>);
}

export default SignupForm
