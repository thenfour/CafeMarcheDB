import { generateToken, hash256 } from "@blitzjs/auth"
import { resolver } from "@blitzjs/rpc"
import db from "db"
import { ForgotPassword } from "../schemas"
import { Permission } from "shared/permissions"

const RESET_PASSWORD_TOKEN_EXPIRATION_IN_HOURS = 48

export default resolver.pipe(
  resolver.zod(ForgotPassword),
  resolver.authorize(Permission.manage_users),
  async ({ email }) => {
    // 1. Get the user
    const user = await db.user.findFirst({ where: { email: email.toLowerCase() } });

    // 2. Generate the token and expiration date.
    const token = generateToken()
    const hashedToken = hash256(token)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + RESET_PASSWORD_TOKEN_EXPIRATION_IN_HOURS)

    // 3. If user with this email was found
    if (user) {
      // 4. Delete any existing password reset tokens
      await db.token.deleteMany({ where: { type: "RESET_PASSWORD", userId: user.id } })
      // 5. Save this new token in the database.
      await db.token.create({
        data: {
          user: { connect: { id: user.id } },
          type: "RESET_PASSWORD",
          expiresAt,
          hashedToken,
          sentTo: user.email,
        },
      })

    } else {
      // 7. If no user found wait the same time so attackers can't tell the difference
      // this is no longer necessary because this feature is only available to admins
      //await new Promise((resolve) => setTimeout(resolve, 750))
    }

    // 8. Return the same result whether a password reset email was sent or not
    const origin = process.env.APP_ORIGIN || process.env.BLITZ_DEV_SERVER_ORIGIN
    const resetUrl = `${origin}/auth/reset-password?token=${token}`
    return resetUrl;
  })
