import { Prisma } from "@prisma/client";
import { AuthorizationError } from "blitz";
import { z } from "zod";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { BandPublicIdSchema } from "src/locale/shared/presentationInput";
import { eventEditorView, xEvent, xEventType, xEventStatus, xBandUserTag, xPermission } from "../db3";
import { gEventRelevanceClass } from "../shared/eventRelevance";
import { createCommandRowServices } from "./db3CommandCore";
import type { DB3ReadRootDatabase } from "./db3ReadExecution";

// This endpoint retains its small scalar patch; the generated command validates each field.
const BasicFields = z.object({
    name: z.string().optional(), locationDescription: z.string().optional(), locationURL: z.string().optional(),
    typeId: xEventType.identitySchema.nullable().optional(), statusId: xEventStatus.identitySchema.nullable().optional(),
    expectedAttendanceUserTagId: xBandUserTag.identitySchema.nullable().optional(),
    visiblePermissionId: xPermission.identitySchema.nullable().optional(), isDeleted: z.boolean().optional(),
    frontpageVisible: z.boolean().optional(), frontpageDate: z.string().optional(), frontpageTime: z.string().optional(),
    frontpageDetails: z.string().optional(), frontpageTitle: z.string().nullable().optional(),
    frontpageLocation: z.string().nullable().optional(), frontpageLocationURI: z.string().nullable().optional(), frontpageTags: z.string().nullable().optional(),
    frontpageDate_nl: z.string().optional(), frontpageTime_nl: z.string().optional(), frontpageDetails_nl: z.string().optional(),
    frontpageTitle_nl: z.string().nullable().optional(), frontpageLocation_nl: z.string().nullable().optional(),
    frontpageLocationURI_nl: z.string().nullable().optional(), frontpageTags_nl: z.string().nullable().optional(),
    frontpageDate_fr: z.string().optional(), frontpageTime_fr: z.string().optional(), frontpageDetails_fr: z.string().optional(),
    frontpageTitle_fr: z.string().nullable().optional(), frontpageLocation_fr: z.string().nullable().optional(),
    frontpageLocationURI_fr: z.string().nullable().optional(), frontpageTags_fr: z.string().nullable().optional(),
});
const EventTarget = z.object({ bandPublicId: BandPublicIdSchema, eventId: xEvent.identitySchema });
export const UpdateEventBasicFieldsSchema = EventTarget.merge(BasicFields).strict();
export const SetEventRelevanceSchema = EventTarget.extend({
    relevanceClassOverrideName: z.enum(["Pinned", "Ongoing", "Upcoming", "RecentPast", "TBD", "Future", "Hidden"]).nullable(),
}).strict();

type EditableFields = z.infer<typeof BasicFields> | { relevanceClassOverride: number | null };

function writeEventFields(database: DB3ReadRootDatabase, authorization: CMServerAuthorization,
    target: z.infer<typeof EventTarget>, fields: EditableFields,
) {
    const command = eventEditorView.crud.operations.update.command;
    const dto = command.parseDto({ identity: target.eventId, patch: fields });
    return database.$transaction(async transaction => {
        const auth = (await authorization.refresh(transaction)).requireUser();
        if (auth.requireBand().publicId !== target.bandPublicId) {
            throw new AuthorizationError("Event editing requires the selected band.");
        }
        await createCommandRowServices(auth, transaction).update(xEvent, dto.identity, dto.patch);
        return { eventId: target.eventId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 });
}

export function updateEventBasicFields(database: DB3ReadRootDatabase, authorization: CMServerAuthorization,
    input: z.infer<typeof UpdateEventBasicFieldsSchema>,
) {
    const { bandPublicId, eventId, ...fields } = UpdateEventBasicFieldsSchema.parse(input);
    return writeEventFields(database, authorization, { bandPublicId, eventId }, fields);
}

export function setEventRelevance(database: DB3ReadRootDatabase, authorization: CMServerAuthorization,
    input: z.infer<typeof SetEventRelevanceSchema>,
) {
    const args = SetEventRelevanceSchema.parse(input);
    return writeEventFields(database, authorization, args, {
        relevanceClassOverride: args.relevanceClassOverrideName === null ? null : gEventRelevanceClass[args.relevanceClassOverrideName],
    });
}
