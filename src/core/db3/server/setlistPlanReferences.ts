import type { Prisma } from "@prisma/client";
import { NotFoundError } from "blitz";
import type { SongPublicId, EventPublicId, WikiPagePublicId, UserPublicId } from "shared/publicId";
import { QuickSearchItemType } from "shared/quickFilter";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { xEvent } from "../shared/schema/event";
import { xSong } from "../shared/schema/song";
import { xUser } from "../shared/schema/user";
import { xWikiPage } from "../shared/schema/wiki";
import type { SetlistPlanPayload } from "../shared/setlistPlanTypes";
import { GetAuthorizedTableReadWhere } from "./db3ReadPolicy";
import { activeBandPersonWhere } from "../shared/entities/user/bandPersonReference";

function collectPayloadReferences(payload: SetlistPlanPayload) {
    const associatedItems = [...payload.columns, ...(payload.columnLeds ?? []), ...(payload.rowLeds ?? [])]
        .flatMap(item => item.associatedItem ? [item.associatedItem] : []);
    return {
        song: [
            ...new Set([...payload.rows.flatMap(row => row.songId ? [row.songId] : []),
            ...associatedItems.flatMap(item => item.itemType === QuickSearchItemType.song ? [item.id] : [])])
        ],
        event: [
            ...new Set(associatedItems.flatMap(item => item.itemType === QuickSearchItemType.event ? [item.id] : []))
        ],
        wikiPage: [
            ...new Set(associatedItems.flatMap(item => item.itemType === QuickSearchItemType.wikiPage ? [item.id] : []))
        ],
        user: [
            ...new Set(associatedItems.flatMap(item => item.itemType === QuickSearchItemType.user ? [item.id] : []))
        ],
    };
}

async function authorizeSongReferences(database: Prisma.TransactionClient, auth: CMServerAuthorization, publicIds: SongPublicId[]) {
    if (publicIds.length === 0) {
        return;
    }
    const policy = await GetAuthorizedTableReadWhere({ table: xSong, auth });
    const count = await database.song.count({
        where: {
            AND: [
                policy,
                {
                    bandId: auth.requireBand().id,
                    isDeleted: false, // lsmb todo: GetAuthorizedTableReadWhere normally handles this; don't attempt to reinvent the mechanism.
                    publicId: { in: publicIds },
                }
            ]
        }
    });
    if (count !== publicIds.length) {
        throw new NotFoundError();
    }
}

async function authorizeEventReferences(database: Prisma.TransactionClient, auth: CMServerAuthorization, publicIds: EventPublicId[]) {
    if (publicIds.length === 0) {
        return;
    }
    const policy = await GetAuthorizedTableReadWhere({ table: xEvent, auth });
    const count = await database.event.count({
        where: {
            AND: [
                policy,
                {
                    bandId: auth.requireBand().id,
                    isDeleted: false, // lsmb todo: GetAuthorizedTableReadWhere normally handles this; don't attempt to reinvent the mechanism.
                    publicId: { in: publicIds },
                }]
        }
    });
    if (count !== publicIds.length) {
        throw new NotFoundError();
    }
}

async function authorizeWikiPageReferences(database: Prisma.TransactionClient, auth: CMServerAuthorization, publicIds: WikiPagePublicId[]) {
    if (publicIds.length === 0) {
        return;
    }
    const policy = await GetAuthorizedTableReadWhere({ table: xWikiPage, auth });
    const count = await database.wikiPage.count({
        where: {
            AND: [
                policy, {
                    bandId: auth.requireBand().id,
                    publicId: { in: publicIds },
                }
            ]
        }
    });
    if (count !== publicIds.length) {
        throw new NotFoundError();
    }
}

async function authorizeUserReferences(database: Prisma.TransactionClient, auth: CMServerAuthorization, publicIds: UserPublicId[]) {
    if (publicIds.length === 0) {
        return;
    }
    const policy = await GetAuthorizedTableReadWhere({ table: xUser, auth });
    const count = await database.user.count({
        where: {
            AND: [
                policy,
                activeBandPersonWhere(auth.requireBand().id),
                { publicId: { in: publicIds } },
            ]
        }
    });
    if (count !== publicIds.length) {
        throw new NotFoundError();
    }
}

/** Validate current reference visibility without rewriting authored content or cached labels. */
export async function authorizePlanPayloadReferences(database: Prisma.TransactionClient, auth: CMServerAuthorization, payload: SetlistPlanPayload) {
    const references = collectPayloadReferences(payload);
    await Promise.all([
        authorizeSongReferences(database, auth, references.song),
        authorizeEventReferences(database, auth, references.event),
        authorizeWikiPageReferences(database, auth, references.wikiPage),
        authorizeUserReferences(database, auth, references.user),
    ]);
}
