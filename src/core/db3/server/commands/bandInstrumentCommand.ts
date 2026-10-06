import type { Prisma } from "@prisma/client";
import { AuthorizationError } from "blitz";
import { Permission } from "shared/permissions";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { ChangeAction, CreateChangeContext, RegisterChange } from "src/auth/server/activityLog";
import { writeBandDynamicString, requireBandWriteLocale, type DynamicStringWriterDatabase } from "src/locale/server/dynamicStringWriter";
import { generatePublicId } from "src/server/publicId";
import { bandInstrumentCommand, type BandInstrumentCommand } from "../../shared/entities/instrument/bandInstrumentContracts";
import { defineCommandHandler } from "../db3CommandCore";

export type InstrumentWriterDatabase = DynamicStringWriterDatabase & Pick<Prisma.TransactionClient,
    "bandInstrument" | "bandInstrumentFunctionalGroup" | "globalInstrument" | "globalInstrumentFunctionalGroup" | "change">;
async function requireGroup(database: InstrumentWriterDatabase, bandId: number, publicId: string) {
    const group = await database.bandInstrumentFunctionalGroup.findFirst({ where: { bandId, publicId } });
    if (!group) throw new AuthorizationError("The functional group is not in the selected band.");
    return group;
}
async function optInGroup(database: InstrumentWriterDatabase, bandId: number, globalId: number) {
    const where = { bandId_globalFunctionalGroupId: { bandId, globalFunctionalGroupId: globalId } };
    const existing = await database.bandInstrumentFunctionalGroup.findUnique({ where });
    const row = existing ?? await database.bandInstrumentFunctionalGroup.create({ data: { publicId: generatePublicId(), bandId, globalFunctionalGroupId: globalId } });
    return { row, created: existing === null };
}
function validateMatcher(matcher: string | null | undefined) {
    if (matcher !== null && matcher !== undefined) {
        try { new RegExp(matcher); } catch { throw new Error("The file matcher must be a valid regular expression."); }
    }
}
async function createStrings(database: InstrumentWriterDatabase, auth: CMServerAuthorization, command: { name: string; description: string; localeTag: string }) {
    await requireBandWriteLocale(database, auth, command.localeTag);
    return {
        nameId: await writeBandDynamicString(database, auth, null, "PlainText", { kind: "set", stringPublicId: null, localeTag: command.localeTag, value: command.name }),
        descriptionId: await writeBandDynamicString(database, auth, null, "Markdown", { kind: "set", stringPublicId: null, localeTag: command.localeTag, value: command.description }),
    };
}

/** The RPC owns the serializable transaction and refreshes grants in that transaction. */
export async function editBandInstrumentCatalog(database: InstrumentWriterDatabase, auth: CMServerAuthorization, input: BandInstrumentCommand) {
    const command = bandInstrumentCommand.parseDto(input);
    auth.requirePermission(Permission.admin_instruments);
    const bandId = auth.requireBand().id;
    const changeContext = CreateChangeContext("band instrument catalog");
    const audit = async (table: string, action: ChangeAction, row: { id: number; publicId: string }, oldValues?: unknown) => {
        await RegisterChange({
            db: database,
            auth,
            changeContext,
            table,
            action,
            pkid: row.id,
            oldValues,
            newValues: row,
        });
        return bandInstrumentCommand.parseResult({ publicId: row.publicId });
    };
    switch (command.kind) {
        case "createGroup": {
            const strings = await createStrings(database, auth, command);
            const row = await database.bandInstrumentFunctionalGroup.create({
                data: {
                    publicId: generatePublicId(),
                    bandId,
                    ...strings,
                    color: command.color,
                    sortOrder: command.sortOrder,
                }
            });
            return audit("BandInstrumentFunctionalGroup", ChangeAction.insert, row);
        }
        case "createInstrument": {
            validateMatcher(command.autoAssignFileLeafRegex);
            const group = await requireGroup(database, bandId, command.functionalGroupId);
            const strings = await createStrings(database, auth, command);
            const row = await database.bandInstrument.create({
                data: {
                    publicId: generatePublicId(), bandId, ...strings,
                    functionalGroupId: group.id, autoAssignFileLeafRegex: command.autoAssignFileLeafRegex, sortOrder: command.sortOrder
                }
            });
            return audit("BandInstrument", ChangeAction.insert, row);
        }
        case "optInGroup": {
            const global = await database.globalInstrumentFunctionalGroup.findUniqueOrThrow({ where: { publicId: command.globalPublicId } });
            const result = await optInGroup(database, bandId, global.id);
            return result.created ? audit("BandInstrumentFunctionalGroup", ChangeAction.insert, result.row)
                : bandInstrumentCommand.parseResult({ publicId: result.row.publicId });
        }
        case "optInInstrument": {
            const global = await database.globalInstrument.findUniqueOrThrow({ where: { publicId: command.globalPublicId } });
            const group = await optInGroup(database, bandId, global.functionalGroupId);
            if (group.created) await audit("BandInstrumentFunctionalGroup", ChangeAction.insert, group.row);
            const existing = await database.bandInstrument.findUnique({ where: { bandId_globalInstrumentId: { bandId, globalInstrumentId: global.id } } });
            if (existing) return bandInstrumentCommand.parseResult({ publicId: existing.publicId });
            const row = await database.bandInstrument.create({ data: { publicId: generatePublicId(), bandId, globalInstrumentId: global.id, functionalGroupId: group.row.id } });
            return audit("BandInstrument", ChangeAction.insert, row);
        }
        case "updateInstrument": {
            const row = await database.bandInstrument.findFirst({ where: { bandId, publicId: command.publicId } });
            if (!row) throw new AuthorizationError("The instrument is not in the selected band.");
            const { name, description, functionalGroupId, ...scalars } = command.patch;
            validateMatcher(scalars.autoAssignFileLeafRegex);
            const group = functionalGroupId === undefined ? null : await requireGroup(database, bandId, functionalGroupId);
            if (!row.globalInstrumentId && (name?.kind === "inherit" || description?.kind === "inherit")) throw new Error("Custom instruments have no global value to inherit.");
            const updated = await database.bandInstrument.update({
                where: { id: row.id }, data: {
                    ...scalars,
                    ...(group ? { functionalGroupId: group.id } : {}),
                    ...(name ? { nameId: await writeBandDynamicString(database, auth, row.nameId, "PlainText", name) } : {}),
                    ...(description ? { descriptionId: await writeBandDynamicString(database, auth, row.descriptionId, "Markdown", description) } : {}),
                }
            });
            return audit("BandInstrument", ChangeAction.update, updated, row);
        }
        case "updateGroup": {
            const row = await requireGroup(database, bandId, command.publicId);
            const { name, description, ...scalars } = command.patch;
            if (!row.globalFunctionalGroupId && (name?.kind === "inherit" || description?.kind === "inherit")) throw new Error("Custom groups have no global value to inherit.");
            const updated = await database.bandInstrumentFunctionalGroup.update({
                where: { id: row.id }, data: {
                    ...scalars,
                    ...(name ? { nameId: await writeBandDynamicString(database, auth, row.nameId, "PlainText", name) } : {}),
                    ...(description ? { descriptionId: await writeBandDynamicString(database, auth, row.descriptionId, "Markdown", description) } : {}),
                }
            });
            return audit("BandInstrumentFunctionalGroup", ChangeAction.update, updated, row);
        }
    }
}
export const bandInstrumentCommandHandler = defineCommandHandler(bandInstrumentCommand,
    (dto, context) => editBandInstrumentCatalog(context.transaction, context.authorization, dto));
