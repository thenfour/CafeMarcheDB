import { SecurePassword } from "@blitzjs/auth/secure-password"
import { resolver } from "@blitzjs/rpc"
import { AuthenticationError } from "blitz"
import db from "db"
import { Login } from "../schemas"
import { CreatePublicData } from "types"

export const authenticateUser = async (rawEmail: string, rawPassword: string) => {
  const { email, password } = Login.parse({ email: rawEmail, password: rawPassword })
  const user = await db.user.findFirst({
    where: { email },
    include: { role: { include: { permissions: { include: { permission: true } } } } }
  })
  if (!user) throw new AuthenticationError()

  const result = await SecurePassword.verify(user.hashedPassword, password)

  if (result === SecurePassword.VALID_NEEDS_REHASH) {
    // Upgrade hashed password with a more secure hash
    const improvedHash = await SecurePassword.hash(password)
    await db.user.update({ where: { id: user.id }, data: { hashedPassword: improvedHash } })
  }

  const { hashedPassword, ...rest } = user
  return rest
}

export default resolver.pipe(
  resolver.zod(Login),
  async ({ email, password }, ctx) => {
    // This throws an error if credentials are invalid
    const user = await authenticateUser(email, password)

    await ctx.session.$create(CreatePublicData({ user }));

    return user
  }
)
