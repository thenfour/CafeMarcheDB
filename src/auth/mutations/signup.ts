import { resolver } from "@blitzjs/rpc";
import { Signup } from "../schemas";
import { createPublicDataFromDatabase } from "../server/effectivePermissions";
import { authorizationDatabase, platformScope } from "../server/authorizationContext";
import { createSignupUser } from "../server/createSignupUser";

export default resolver.pipe(
  resolver.zod(Signup),
  async (fields, ctx) => {
    const user = await createSignupUser(fields, ctx);

    await ctx.session.$create(await createPublicDataFromDatabase(authorizationDatabase, { user }, platformScope));
    return { id: user.id, name: user.name, email: user.email };
  });
