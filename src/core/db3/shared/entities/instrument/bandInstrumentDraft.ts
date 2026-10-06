import type { InstrumentFunctionalGroupPublicId } from "shared/publicId";
import type { z } from "zod";
import type { LocalizedFieldEditSchema } from "src/locale/shared/dynamicStringWrite";
import type { BandInstrumentCommand, BandInstrumentDto, BandInstrumentGroupDto } from "./bandInstrumentContracts";

export type InstrumentCatalogEntry = BandInstrumentDto | BandInstrumentGroupDto;
export interface InstrumentCatalogDraft {
    readonly mode: "instrument" | "group";
    readonly entry?: InstrumentCatalogEntry;
    readonly localeTag: string;
    readonly name: string;
    readonly description: string;
    readonly nameChanged: boolean;
    readonly descriptionChanged: boolean;
    readonly inheritName: boolean;
    readonly inheritDescription: boolean;
    readonly groupId?: InstrumentFunctionalGroupPublicId;
    readonly sortOrder: string;
    readonly hidden: boolean;
    readonly color: string;
    readonly matcher: string;
}
function fieldEdit(draft: InstrumentCatalogDraft, field: "name" | "description"): z.infer<typeof LocalizedFieldEditSchema> | undefined {
    const stringPublicId = field === "name" ? draft.entry?.nameStringPublicId ?? null : draft.entry?.descriptionStringPublicId ?? null;
    const inherit = field === "name" ? draft.inheritName : draft.inheritDescription;
    const changed = field === "name" ? draft.nameChanged : draft.descriptionChanged;
    if (inherit && stringPublicId) return { kind: "inherit", stringPublicId };
    return changed ? { kind: "set", stringPublicId, localeTag: draft.localeTag, value: draft[field] } : undefined;
}
export function buildInstrumentCatalogCommand(draft: InstrumentCatalogDraft): BandInstrumentCommand {
    const name = fieldEdit(draft, "name");
    const description = fieldEdit(draft, "description");
    const strings = {
        ...(name ? { name } : {}),
        ...(description ? { description } : {})
    };
    const sortOrder = draft.sortOrder === "" ? null : Number(draft.sortOrder);
    if (draft.mode === "instrument") {
        if (!draft.groupId) throw new Error("Choose a functional group.");
        const autoAssignFileLeafRegex = draft.matcher === "" ? null : draft.matcher;
        return draft.entry && "functionalGroupId" in draft.entry
            ? {
                kind: "updateInstrument", publicId: draft.entry.publicId,
                patch: { ...strings, functionalGroupId: draft.groupId, sortOrder, isHidden: draft.hidden, autoAssignFileLeafRegex }
            }
            : {
                kind: "createInstrument", functionalGroupId: draft.groupId, name: draft.name, description: draft.description,
                localeTag: draft.localeTag, sortOrder, autoAssignFileLeafRegex
            };
    }
    const color = draft.color === "" ? null : draft.color;
    return draft.entry && "color" in draft.entry
        ? {
            kind: "updateGroup",
            publicId: draft.entry.publicId,
            patch: {
                ...strings,
                color,
                sortOrder,
                isHidden: draft.hidden
            }
        }
        : {
            kind: "createGroup",
            name: draft.name,
            description: draft.description,
            localeTag: draft.localeTag,
            color,
            sortOrder
        };
}
