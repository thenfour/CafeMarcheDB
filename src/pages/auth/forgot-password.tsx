import { defineCmdbPage } from "src/route/cmdbPage";

const ForgotPasswordPage = () => {
  return <div className="resetPasswordPage">
    <div className="resetPasswordContent">

      <h1>Reset password</h1>
      <p>Please ask an admin to reset your password. They will then send you a link where you can set a new password.
      </p>
    </div>
  </div>
    ;
}

defineCmdbPage("auth_forgot-password", ForgotPasswordPage);
export default ForgotPasswordPage;
