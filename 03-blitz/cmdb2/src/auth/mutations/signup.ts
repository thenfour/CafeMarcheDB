import { SecurePassword } from "@blitzjs/auth/secure-password";
import { resolver } from "@blitzjs/rpc";
import db from "db";
import { Signup } from "../schemas";
import { CreatePublicData } from "types";

export default resolver.pipe(
  resolver.zod(Signup),
  async ({ email, password, name, googleId }, ctx) => {
    const hashedPassword = await SecurePassword.hash(password.trim())
    email = email.toLowerCase().trim();
    try {
      const user = await db.user.create({
        data: {
          email,
          hashedPassword,
          isSysAdmin: (email == process.env.ADMIN_EMAIL),
          name,
          googleId,
        },
        include: { role: { include: { permissions: { include: { permission: true } } } } }
        //select: { id: true, name: true, email: true, roleId: true, role: true, googleId: true, isSysAdmin: true },
      });

      // todo: register in change log.

      await ctx.session.$create(CreatePublicData(user));
      return user;

    } catch (e) {
      console.error(`Exception while creating user`);
      console.error(e);
      throw (e);
    }
  });
