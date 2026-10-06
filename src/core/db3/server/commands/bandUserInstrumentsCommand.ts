import { Prisma } from "@prisma/client";
import { AuthorizationError } from "blitz";
import { Permission } from "shared/permissions";
import { parsePublicId, type BandUserPublicId } from "shared/publicId";
import { ChangeAction, CreateChangeContext, RegisterChange, type ChangeContext } from "src/auth/server/activityLog";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { bandUserInstrumentsCommand, xBandUser, xBandUserInstrument, type BandUserInstrumentsEdit } from "../../shared/entities/user/bandUserInstruments";
import { xBandInstrument } from "../../shared/entities/instrument/bandInstrumentContracts";
import { deriveFieldWriteSchema } from "../../shared/core/db3FieldValidation";
import { defineCommandHandler } from "../db3CommandCore";
import { UpdateAssociations } from "../db3mutationCore";
import { resolvePublicIds } from "../db3PublicIds";

async function requireEditableMembership(database: Prisma.TransactionClient, auth: CMServerAuthorization, publicId: BandUserPublicId) {
    auth.requirePermission(Permission.login);
    const membership = await database.bandUser.findFirst({ where: {
        publicId, bandId: auth.requireBand().id, isDeleted: false,
        user: { isDeleted: false, mergedIntoUserId: null },
    } });
    if (!membership || !xBandUser.authorizeRowForEdit({ model: membership, auth })) {
        throw new AuthorizationError("The membership cannot be edited.");
    }
    return membership;
}

const storedAssignmentArgs = Prisma.validator<Prisma.BandUserInstrumentDefaultArgs>()({
    include: { bandInstrument: { select: { publicId: true, bandId: true } } },
});
type StoredAssignment = Prisma.BandUserInstrumentGetPayload<typeof storedAssignmentArgs>;

/** Keep unchanged hidden assignments; only additions must resolve through the visible band catalog. */
async function resolveDesiredInstruments(database: Prisma.TransactionClient, auth: CMServerAuthorization,
    edit: Extract<BandUserInstrumentsEdit, { kind: "replace" }>, existing: readonly StoredAssignment[],
): Promise<number[]> {
    const retained = new Map(existing.map(row => [row.bandInstrument.publicId, row.bandInstrumentId]));
    const additions = edit.instrumentIds.filter(publicId => !retained.has(publicId));
    const addedIds = await resolvePublicIds(xBandInstrument, additions, auth, database);
    const identities = new Map(additions.map((publicId, index) => [publicId, addedIds[index]!]));
    return edit.instrumentIds.map(publicId => retained.get(publicId) ?? identities.get(publicId)!);
}

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
    const membership = await requireEditableMembership(database, auth, edit.membershipId);
    const changeContext = CreateChangeContext("BandUser_EditInstruments");
    const loadAssignments = () => database.bandUserInstrument.findMany({
        ...storedAssignmentArgs, where: { bandUserId: membership.id }, orderBy: { publicId: "asc" },
    });
    const existing = await loadAssignments();
    for (const assignment of existing) {
        auth.requireBandResource(assignment.bandInstrument.bandId);
    }
    if (edit.kind === "replace") {
        const desiredTagIds = await resolveDesiredInstruments(database, auth, edit, existing);
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
