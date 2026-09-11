import { resolver } from "@blitzjs/rpc";
import { Signup } from "../schemas";
import db from "db";
import { createPublicDataFromDatabase } from "../server/effectivePermissions";
import { createSignupUser } from "../server/createSignupUser";

export default resolver.pipe(
  resolver.zod(Signup),
  async (fields, ctx) => {
    const user = await createSignupUser(fields, ctx);

    await ctx.session.$create(await createPublicDataFromDatabase(db, { user }));
    return { id: user.id, name: user.name, email: user.email };
  });
