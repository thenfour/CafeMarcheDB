//import { LabeledTextField } from "src/core/components/LabeledTextField"
//import { Form, FORM_ERROR } from "src/core/components/Form"
import signup from "src/auth/mutations/signup"
import { Signup } from "src/auth/schemas"
import { useMutation } from "@blitzjs/rpc"
import React, { Suspense } from "react";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { FormControlLabel } from "@mui/material";

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

  return (<div>
    <h1>Create an Account</h1>
    <form onSubmit={handleSubmit} method="">
      <div><FormControlLabel label="Full name" control={<input type="text" placeholder="full name" value={name} onChange={e => setName(e.target.value)} />} /></div>
      <div><FormControlLabel label="Email" control={<input type="text" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />} /></div>
      <div><FormControlLabel label="Password" control={<input type="password" placeholder="password" value={password} onChange={e => setPassword(e.target.value)} />} /></div>
      <div><input type="submit" value="subm" /></div>
    </form>
  </div>);
}

export default SignupForm
