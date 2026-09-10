import { ServerApi } from "@/src/server/serverApi"
import { generateToken, hash256 } from "@blitzjs/auth"
import { resolver } from "@blitzjs/rpc"
import db from "db"
import { Permission } from "shared/permissions"
import { ForgotPassword } from "../schemas"
import { requireActualSysadmin } from "../server/actualSysadmin"
import { requireCanManageUser } from "../server/userManagementPolicy"

const RESET_PASSWORD_TOKEN_EXPIRATION_IN_HOURS = 48

export default resolver.pipe(
  resolver.zod(ForgotPassword),
  resolver.authorize(Permission.sysadmin),
  async ({ email }, ctx) => {
    // Permission.sysadmin can exist in a role. This emergency operation instead
    // requires the freshly-read User.isSysAdmin flag before target lookup or
    // reset-token generation.
    await requireActualSysadmin(db, ctx.session.userId)

    const user = await db.user.findFirst({
      select: { id: true, email: true, isDeleted: true, isSysAdmin: true },
      where: { email: email.toLowerCase() },
    })
    if (user) {
      requireCanManageUser({
        actor: { id: ctx.session.userId, isSysAdmin: true },
        target: user,
        action: "resetPassword",
      })
    }

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
      await new Promise((resolve) => setTimeout(resolve, 750))
    }

    // 8. Return the same result whether a password reset email was sent or not

    const resetUrl = ServerApi.getAbsoluteUri(`/auth/reset-password?token=${token}`);
    return resetUrl;
  })
