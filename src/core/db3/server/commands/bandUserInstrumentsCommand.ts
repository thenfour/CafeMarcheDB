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
