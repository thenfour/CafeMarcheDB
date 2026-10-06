import type { Prisma } from "@prisma/client";
import { Permission } from "shared/permissions";
import { CreateChangeContext } from "src/auth/server/activityLog";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { xBandUser } from "../../shared/entities/user/bandUser";
import { xBandUserTag } from "../../shared/entities/user/bandUserTagViews";
import { bandUserTagsCommand, type BandUserTagsEdit } from "../../shared/entities/user/bandUserTags";
import { defineCommandHandler } from "../db3CommandCore";
import { requireEditableBandMembership, resolveMemberAssignmentTargets } from "../db3MemberAssignments";
import { UpdateAssociations } from "../db3mutationCore";

/** Shared command execution supplies Serializable isolation and refreshed grants. */
export async function editBandUserTags(database: Prisma.TransactionClient, auth: CMServerAuthorization, rawEdit: BandUserTagsEdit) {
    const edit = bandUserTagsCommand.parseDto(rawEdit);
    auth.requirePermission(Permission.manage_users);
    const membership = await requireEditableBandMembership(database, auth, edit.membershipId);
    const assignments = await database.bandUserTagAssignment.findMany({
        where: { bandUserId: membership.id },
        include: {
            bandUserTag: {
                select: {
                    id: true,
                    publicId: true,
                    bandId: true
                }
            }
        },
    });

    const desiredTagIds = await resolveMemberAssignmentTargets(database, auth, xBandUserTag,
        edit.tagIds, assignments.map(row => row.bandUserTag));

    await UpdateAssociations({
        auth, changeContext: CreateChangeContext("BandUser_SetTags"),
        localTable: xBandUser, column: xBandUser.fields.bandUserTagAssignments,
        desiredTagIds, localId: membership.id, localModel: membership, rowMode: "update", db: database,
    });
    return { membershipId: xBandUser.parseIdentity(membership.publicId) };
}

export const bandUserTagsCommandHandler = defineCommandHandler(bandUserTagsCommand,
    (edit, context) => editBandUserTags(context.transaction, context.authorization, edit));
