import { hash256 } from "@blitzjs/auth"
import { SecurePassword } from "@blitzjs/auth/secure-password"
import { resolver } from "@blitzjs/rpc"
import db from "db"
import { ResetPassword } from "../schemas"
import login from "./login"
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/utils"

export class ResetPasswordError extends Error {
  name = "ResetPasswordError"
  message = "Reset password link is invalid or it has expired."
}

export default resolver.pipe(
  resolver.zod(ResetPassword),
  async ({ password, token }, ctx) => {

    // 1. Try to find this token in the database
    const hashedToken = hash256(token)
    const possibleToken = await db.token.findFirst({
      where: { hashedToken, type: "RESET_PASSWORD" },
      include: { user: true },
    })

    // 2. If token not found, error
    if (!possibleToken) {
      throw new ResetPasswordError()
    }
    const savedToken = possibleToken

    // 3. Delete token so it can't be used again
    await db.token.delete({ where: { id: savedToken.id } })

    // 4. If token has expired, error
    if (savedToken.expiresAt < new Date()) {
      throw new ResetPasswordError()
    }

    const userId = savedToken.userId;

    const oldValues = await db.user.findFirst({ where: { id: userId } });

    // 5. Since token is valid, now we can update the user's password
    const hashedPassword = await SecurePassword.hash(password.trim())
    const user = await db.user.update({
      where: { id: userId },
      data: { hashedPassword },
    })

    await RegisterChange({
      action: ChangeAction.update,
      changeContext: CreateChangeContext("resetPasswordMutation"),
      table: "user",
      pkid: userId,
      oldValues,
      newValues: user,
      ctx,
    });


    // 6. Revoke all existing login sessions for this user
    await db.session.deleteMany({ where: { userId: user.id } })

    // 7. Now log the user in with the new credentials
    await login({ email: user.email, password }, ctx)

    return true
  }
)
