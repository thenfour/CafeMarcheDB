import { SecurePassword } from "@blitzjs/auth/secure-password";
import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { Signup } from "../schemas";
import { CreatePublicData } from "types";

// interface SignupArgs {
//   email: string;
//   password: string;
//   name: string;
//   googleId: string | null;
//   roleId: string | null;
//   isSysAdmin?: boolean;
// };

type CreateInput = Prisma.UserCreateInput & {
  password?: string;
};

export default resolver.pipe(
  resolver.zod(Signup),
  async (fields: CreateInput, ctx: any) => {
    fields.hashedPassword = await SecurePassword.hash(fields.password?.trim());
    delete fields.password;
    fields.email = fields.email.toLowerCase().trim();
    fields.isSysAdmin = (fields.email == process.env.ADMIN_EMAIL);
    try {
      const user = await db.user.create({
        // data: {
        //   email,
        //   hashedPassword,
        //   isSysAdmin: (email == process.env.ADMIN_EMAIL),
        //   name,
        //   googleId,
        //   roleId,
        // },
        data: fields,
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
