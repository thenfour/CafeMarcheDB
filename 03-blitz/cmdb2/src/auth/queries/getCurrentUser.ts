import { Ctx } from "blitz"
import db, { prisma } from "db"
import { User } from "db"
import { Permission } from "shared/permissions";

export default async function getCurrentUser(_ = null, { session }: Ctx) {

  if (!session.userId) {
    return null
  }

  const user = await db.user.findFirst({
    where: { id: session.userId },
    include: { role: { include: { permissions: { include: { permission: true } } } } }
  });

  return user;
}
