import type { Prisma } from "@prisma/client";
import { Permission } from "shared/permissions";
import { ChangeAction, CreateChangeContext, RegisterChange } from "src/auth/server/activityLog";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { xUserMinimum } from "../../shared/schema/user";
import { xBandUser } from "../../shared/entities/user/bandUser";
import { bandUserProfileCommand, type BandUserProfileEdit } from "../../shared/entities/user/bandUserProfile";
import { defineCommandHandler } from "../db3CommandCore";
import { requireActiveBandMembership } from "../db3MemberAssignments";

/** The shared command endpoint refreshes grants and supplies Serializable execution. */
export async function editBandUserProfile(database: Prisma.TransactionClient, auth: CMServerAuthorization, rawEdit: BandUserProfileEdit) {
    const edit = bandUserProfileCommand.parseDto(rawEdit);
    const membership = await requireActiveBandMembership(database, auth, edit.membershipId);
    if (membership.userId !== auth.userId) {
        auth.requirePermission(Permission.manage_global_users);
    }
    const person = await database.user.findUniqueOrThrow({
        where: { id: membership.userId }, select: { publicId: true, name: true, phone: true },
    });
    const next = { name: edit.name, phone: edit.phone === undefined ? person.phone : edit.phone === "" ? null : edit.phone };
    if (person.name !== next.name || person.phone !== next.phone) {
        await database.user.update({ where: { id: membership.userId }, data: next });
        await RegisterChange({
            action: ChangeAction.update,
            changeContext: CreateChangeContext(bandUserProfileCommand.commandID),
            table: "User",
            pkid: membership.userId,
            oldValues: { name: person.name, phone: person.phone },
            newValues: next,
            auth,
            db: database,
        });
    }
    return { membershipId: xBandUser.parseIdentity(membership.publicId), personId: xUserMinimum.parseIdentity(person.publicId) };
}

export const bandUserProfileCommandHandler = defineCommandHandler(bandUserProfileCommand,
    (edit, context) => editBandUserProfile(context.transaction, context.authorization, edit));
