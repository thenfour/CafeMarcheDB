import { serverPortalHosting } from "src/route/server/portalConfig";
import { Prisma } from "@prisma/client";
import { parsePublicId } from "shared/publicId";
import { portalHref } from "src/route/portalRouting";
import { resolveAuthorizedDynamicStrings } from "src/locale/server/localization";
import { collectLocalePreferences, selectFormattingLocale } from "src/locale/shared/localePreferences";
import type { PresentationInput } from "src/locale/shared/presentationInput";
import { loadBandTimeZone } from "src/server/bandTimeZone";
import type { AuditReference } from "../../shared/audit/auditContracts";

const eventSelection = Prisma.validator<Prisma.EventSelect>()({
    publicId: true, name: true, startsAt: true, isDeleted: true, bandId: true,
    band: { select: { publicId: true } },
});
type AuditEvent = Prisma.EventGetPayload<{ select: typeof eventSelection }>;

function recordReference(publicId: string, label: string, deleted: boolean, bandPublicId: string | null,
    path: string | null, input: PresentationInput): AuditReference {
    return { publicId, label, deleted, bandPublicId,
        href: deleted || path === null ? null : portalHref(path, {
            bandPublicId: bandPublicId === null ? null : parsePublicId<"Band">(bandPublicId), routeLocale: input.routeLocale,
        }, serverPortalHosting()),
    };
}

async function eventReference(database: Prisma.TransactionClient, event: AuditEvent | null,
    input: PresentationInput): Promise<AuditReference | null> {
    if (!event) {
        return null;
    }
    const timeZone = await loadBandTimeZone(database, event.bandId);
    const locale = selectFormattingLocale(collectLocalePreferences(input));
    const date = event.startsAt === null ? "TBD" : new Intl.DateTimeFormat(locale, {
        day: "2-digit", month: "short", year: "numeric", timeZone,
    }).format(event.startsAt);
    return recordReference(event.publicId, `${event.name} (${date})`, event.isDeleted, event.band.publicId,
        `/backstage/event/${event.publicId}`, input);
}

// The audit reader checks platform Sysadmin authority before loading these navigation labels.
// Historical snapshots stay untouched; only the record column uses current labels and links.
export async function readAuditRecord(database: Prisma.TransactionClient, tableName: string, recordId: number,
    input: PresentationInput): Promise<AuditReference | null> {
    switch (tableName.toLowerCase()) {
        case "event":
            return eventReference(database, await database.event.findUnique({ where: { id: recordId }, select: eventSelection }), input);
        case "song": {
            const row = await database.song.findUnique({ where: { id: recordId }, select: {
                publicId: true, name: true, isDeleted: true, band: { select: { publicId: true } },
            } });
            return row ? recordReference(row.publicId, row.name, row.isDeleted, row.band.publicId, `/backstage/song/${row.publicId}`, input) : null;
        }
        case "user": {
            const row = await database.user.findUnique({ where: { id: recordId }, select: { publicId: true, name: true, isDeleted: true } });
            return row ? recordReference(row.publicId, row.name, row.isDeleted, null, `/backstage/user/${row.publicId}`, input) : null;
        }
        case "banduser": {
            const row = await database.bandUser.findUnique({ where: { id: recordId }, select: {
                isDeleted: true, user: { select: { publicId: true, name: true, isDeleted: true } }, band: { select: { publicId: true } },
            } });
            return row ? recordReference(row.user.publicId, row.user.name, row.isDeleted || row.user.isDeleted, row.band.publicId,
                `/backstage/user/${row.user.publicId}`, input) : null;
        }
        case "file": {
            const row = await database.file.findUnique({ where: { id: recordId }, select: {
                publicId: true, fileLeafName: true, isDeleted: true, band: { select: { publicId: true } },
            } });
            return row ? recordReference(row.publicId, row.fileLeafName, row.isDeleted, row.band.publicId, `/backstage/file/${row.publicId}`, input) : null;
        }
        case "eventsegment":
        case "eventsonglist": {
            const selection = { publicId: true, name: true, event: { select: eventSelection } } as const;
            const row = tableName.toLowerCase() === "eventsegment"
                ? await database.eventSegment.findUnique({ where: { id: recordId }, select: selection })
                : await database.eventSongList.findUnique({ where: { id: recordId }, select: selection });
            return row ? recordReference(row.publicId, row.name, row.event.isDeleted, row.event.band.publicId,
                `/backstage/event/${row.event.publicId}`, input) : null;
        }
        case "eventuserresponse": {
            const row = await database.eventUserResponse.findUnique({ where: { id: recordId }, select: { publicId: true, event: { select: eventSelection } } });
            return row ? recordReference(row.publicId, row.publicId, row.event.isDeleted, row.event.band.publicId,
                `/backstage/event/${row.event.publicId}`, input) : null;
        }
        case "eventsegmentuserresponse": {
            const row = await database.eventSegmentUserResponse.findUnique({ where: { id: recordId }, select: {
                publicId: true, eventSegment: { select: { event: { select: eventSelection } } },
            } });
            const event = row?.eventSegment.event;
            return row && event ? recordReference(row.publicId, row.publicId, event.isDeleted, event.band.publicId,
                `/backstage/event/${event.publicId}`, input) : null;
        }
        case "bandinstrument": {
            const row = await database.bandInstrument.findUnique({ where: { id: recordId }, select: {
                publicId: true, nameId: true, bandId: true, band: { select: { publicId: true } }, globalInstrument: { select: { nameId: true } },
            } });
            if (!row) {
                return null;
            }
            const nameId = row.nameId ?? row.globalInstrument?.nameId;
            const strings = nameId === undefined ? null : await resolveAuthorizedDynamicStrings(database, { band: { id: row.bandId } }, [nameId], input);
            const label = nameId === undefined ? row.publicId : strings?.get(nameId)?.value ?? row.publicId;
            return recordReference(row.publicId, label, false, row.band.publicId, null, input);
        }
        default:
            return null;
    }
}

export async function readAuditFileTags(database: Prisma.TransactionClient, recordId: number,
    input: PresentationInput): Promise<AuditReference[]> {
    const row = await database.file.findUnique({ where: { id: recordId }, select: {
        taggedEvents: { select: { eventId: true } }, taggedSongs: { select: { songId: true } },
        taggedUsers: { select: { bandUserId: true } }, taggedInstruments: { select: { bandInstrumentId: true } },
    } });
    if (!row) {
        return [];
    }
    const candidates = [
        ...row.taggedEvents.map(item => ({ table: "Event", id: item.eventId })),
        ...row.taggedSongs.map(item => ({ table: "Song", id: item.songId })),
        ...row.taggedUsers.map(item => ({ table: "BandUser", id: item.bandUserId })),
        ...row.taggedInstruments.map(item => ({ table: "BandInstrument", id: item.bandInstrumentId })),
    ];
    const references: AuditReference[] = [];
    for (const candidate of candidates) {
        const reference = await readAuditRecord(database, candidate.table, candidate.id, input);
        if (reference) {
            references.push(reference);
        }
    }
    return references;
}
