import { Ctx } from "blitz";
import db from "db";
import * as db3 from "src/core/db3/db3";

export default async function getCurrentUser(_ = null, { session }: Ctx) {

  if (!session.userId) {
    return null;
  }

  const user = await db.user.findFirst({
    where: { id: session.userId },
    include: db3.UserArgs.include
  });

  return user;
}
