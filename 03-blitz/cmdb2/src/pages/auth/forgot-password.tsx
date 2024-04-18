
// const ForgotPasswordPage: BlitzPage = () => {
//   const [forgotPasswordMutation, { isSuccess }] = useMutation(forgotPassword)

//   return (
//     <Layout title="Forgot Your Password?">
//       <h1>Forgot your password?</h1>

//       {isSuccess ? (
//         <div>
//           <h2>Request Submitted</h2>
//           <p>
//             If your email is in our system, you will receive instructions to reset your password
//             shortly.
//           </p>
//         </div>
//       ) : (
//         <Form
//           submitText="Send Reset Password Instructions"
//           schema={ForgotPassword}
//           initialValues={{ email: "" }}
//           onSubmit={async (values) => {
//             try {
//               await forgotPasswordMutation(values)
//             } catch (error: any) {
//               return {
//                 [FORM_ERROR]: "Sorry, we had an unexpected error. Please try again.",
//               }
//             }
//           }}
//         >
//           <LabeledTextField name="email" label="Email" placeholder="Email" />
//         </Form>
//       )}
//     </Layout>
//   )
// }

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

export default ForgotPasswordPage
