import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import type { Prisma } from "@prisma/client";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { bandInstrumentCommand, xBandInstrument, xBandInstrumentFunctionalGroup, type BandInstrumentCommand } from "../../shared/entities/instrument/bandInstrumentContracts";
import { createCommandRowServices, defineCommandHandler } from "../db3CommandCore";

export type InstrumentWriterDatabase = Prisma.TransactionClient;

/** Instrument opt-in composes ordinary catalog row services and ensures its group exists. */
export async function optInBandInstrumentCatalog(database: InstrumentWriterDatabase, authorization: CMServerAuthorization,
    input: BandInstrumentCommand,
) {
    const auth = await authorization.refresh(database);
    auth.requirePermission(BandPermission.admin_instruments);
    auth.requireBand();
    const command = bandInstrumentCommand.parseDto(input);
    const rows = createCommandRowServices(auth, database);
    const result = (publicId: unknown) => bandInstrumentCommand.parseResult({ publicId });
    switch (command.kind) {
        case "optInGroup":
            return result((await rows.optIn(xBandInstrumentFunctionalGroup, command.globalPublicId)).publicId);
        case "optInInstrument": {
            const source = await database.globalInstrument.findUniqueOrThrow({ where: { publicId: command.globalPublicId } });
            const sourceGroup = await database.globalInstrumentFunctionalGroup.findUniqueOrThrow({ where: { id: source.functionalGroupId } });
            const group = await rows.optIn(xBandInstrumentFunctionalGroup, sourceGroup.publicId);
            return result((await rows.optIn(xBandInstrument, command.globalPublicId, { functionalGroupId: group.publicId })).publicId);
        }
    }
}
export const bandInstrumentCommandHandler = defineCommandHandler(bandInstrumentCommand,
    (dto, context) => optInBandInstrumentCatalog(context.transaction, context.authorization, dto));
