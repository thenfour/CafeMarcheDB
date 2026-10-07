import { Prisma } from "@prisma/client";
import { parsePublicId } from "shared/publicId";
import { ChangeAction, CreateChangeContext, RegisterChange, type ChangeContext } from "src/auth/server/activityLog";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { bandUserInstrumentsCommand, xBandUserInstrument, type BandUserInstrumentsEdit } from "../../shared/entities/user/bandUserInstruments";
import { xBandUser } from "../../shared/entities/user/bandUser";
import { xBandInstrument } from "../../shared/entities/instrument/bandInstrumentContracts";
import { deriveFieldWriteSchema } from "../../shared/core/db3FieldValidation";
import { defineCommandHandler } from "../db3CommandCore";
import { UpdateAssociations } from "../db3mutationCore";
import { requireEditableBandMembership, resolveMemberAssignmentTargets } from "../db3MemberAssignments";

const storedAssignmentArgs = Prisma.validator<Prisma.BandUserInstrumentDefaultArgs>()({
    include: { bandInstrument: { select: { publicId: true, bandId: true } } },
});
type StoredAssignment = Prisma.BandUserInstrumentGetPayload<typeof storedAssignmentArgs>;

function choosePrimary(edit: BandUserInstrumentsEdit, rows: readonly StoredAssignment[]): number | null {
    if (edit.kind === "setPrimary") {
        const selected = rows.find(row => row.bandInstrument.publicId === edit.instrumentId);
        if (!selected) {
            throw new Error("The primary instrument must already be assigned to this membership.");
        }
        return selected.id;
    }
    // Rows use public-identity order, so removal of the default has a stable replacement.
    return rows.find(row => row.isPrimary)?.id ?? rows[0]?.id ?? null;
}

async function persistPrimaryAssignment(database: Prisma.TransactionClient, auth: CMServerAuthorization,
    changeContext: ChangeContext, assignments: readonly StoredAssignment[], primaryId: number | null,
): Promise<void> {
    const primaryValue = deriveFieldWriteSchema(xBandUserInstrument.fields.isPrimary);
    for (const assignment of assignments) {
        const isPrimary = primaryValue.parse(assignment.id === primaryId);
        if (assignment.isPrimary === isPrimary) {
            continue;
        }
        await database.bandUserInstrument.update({ where: { id: assignment.id }, data: { isPrimary } });
        await RegisterChange({
            action: ChangeAction.update, changeContext, table: xBandUserInstrument.tableName, pkid: assignment.id,
            oldValues: { isPrimary: assignment.isPrimary }, newValues: { isPrimary }, auth, db: database,
        });
    }
}

/** The shared command endpoint owns Serializable execution and authorization refresh. */
export async function editBandUserInstruments(database: Prisma.TransactionClient, auth: CMServerAuthorization,
    rawEdit: BandUserInstrumentsEdit,
) {
    const edit = bandUserInstrumentsCommand.parseDto(rawEdit);
    const membership = await requireEditableBandMembership(database, auth, edit.membershipId);
    const changeContext = CreateChangeContext("BandUser_EditInstruments");
    const loadAssignments = () => database.bandUserInstrument.findMany({
        ...storedAssignmentArgs, where: { bandUserId: membership.id }, orderBy: { publicId: "asc" },
    });
    const existing = await loadAssignments();
    for (const assignment of existing) {
        auth.requireBandResource(assignment.bandInstrument.bandId);
    }
    if (edit.kind === "replace") {
        const desiredTagIds = await resolveMemberAssignmentTargets(database, auth, xBandInstrument,
            edit.instrumentIds, existing.map(row => ({ ...row.bandInstrument, id: row.bandInstrumentId })));
        await UpdateAssociations({
            auth, changeContext, localTable: xBandUser, column: xBandUser.fields.bandUserInstruments,
            desiredTagIds, localId: membership.id, localModel: membership, rowMode: "update", db: database,
        });
    }
    const assignments = edit.kind === "replace" ? await loadAssignments() : existing;
    const primaryId = choosePrimary(edit, assignments);
    await persistPrimaryAssignment(database, auth, changeContext, assignments, primaryId);
    return { membershipId: parsePublicId<"BandUser">(membership.publicId) };
}

export const bandUserInstrumentsCommandHandler = defineCommandHandler(bandUserInstrumentsCommand,
    (edit, context) => editBandUserInstruments(context.transaction, context.authorization, edit));


// MIGRATION_RESTORE: member-profile
// Source: 3bdf5b99754f60c1fb42c83779cf3ee9b9cf33de:src/core/db3/mutations/updateUserPrimaryInstrumentMutation.ts:1-54
// Reason: The basic membership profile no longer routes through the complete user-detail workflow.
// Restore: Restore reachable profile tabs, attendance, credits, wiki contributions, permitted account controls, and profile activity recording with explicit ownership.
// Verification: Test tab URLs, self/admin/outsider permissions and context switches; exercise each restored profile workflow in the built app.
// SHA256: 037efce72d6a9258aa5bad89fb205696ce85a33d430898a3081fbd6df4a6d037
// MIGRATION_REFERENCE_BEGIN
// import { cmauthorize, type CMAuthCtxWithUser } from "@/src/auth/server/cmResolver";
// import { resolver } from "@blitzjs/rpc";
// import db from "db";
// import { Permission } from "shared/permissions";
// import * as db3 from "../db3";
// import * as mutationCore from "../server/db3mutationCore";
// import { resolvePublicId } from "../server/db3PublicIds";
// import { TupdateUserPrimaryInstrumentMutationArgs } from "../shared/apiTypes";
//
// // entry point ////////////////////////////////////////////////
// export default resolver.pipe(
//     cmauthorize(Permission.login),
//     async (args: TupdateUserPrimaryInstrumentMutationArgs, ctx: CMAuthCtxWithUser) => {
//         const auth = ctx.auth;
//         const instrumentId = await resolvePublicId(db3.xInstrument, args.instrumentId, auth, db);
//
//         // load ALL instruments because it's always a small list,
//         // and we want to get multiple data:
//         // - where is primary already
//         // - and, the new instrument id.
//         // this could be done in SQL with like, UPDATE UserInstruments SET isPrimary = (u.instrumentId = requestedId) WHERE userID = userID
//         const existingInstruments = await db.userInstrument.findMany({
//             where: {
//                 userId: ctx.session.userId,
//             }
//         });
//         if (!existingInstruments) {
//             return args;
//         }
//         const existingIds: number[] = [];
//         let newId: number | null = null;
//
//         for (let i = 0; i < existingInstruments.length; ++i) {
//             const ei = existingInstruments[i]!;
//             if (ei.isPrimary) existingIds.push(ei.id);
//             if (ei.instrumentId === instrumentId) newId = ei.id;
//         }
//
//         for (let i = 0; i < existingIds.length; ++i) {
//             await mutationCore.updateImpl(db3.xUserInstrument, existingIds[i]!, {
//                 isPrimary: false,
//             }, ctx.auth);
//         }
//
//         if (newId) {
//             await mutationCore.updateImpl(db3.xUserInstrument, newId, {
//                 isPrimary: true,
//             }, ctx.auth);
//         }
//
//         return args;
//     }
// );
//
// MIGRATION_REFERENCE_END
