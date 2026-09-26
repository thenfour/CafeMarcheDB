// for the admin log, some values need to be looked up dynamically (not cached). like how to see which event corresponds to an eventSegmentUserResponse.
// this query does that conversion.

import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";

type TInput = {
    tableName: string;
    pk: number;
};

export default resolver.pipe(
    resolver.authorize(Permission.sysadmin),
    async (input: TInput, ctx: AuthenticatedCtx) => {
        try {
            // Intentional read-policy bypass: audit history must resolve rows
            // that are now hidden or soft-deleted. This endpoint is restricted
            // to the protected sysadmin capability.
            if (typeof (input.tableName) !== "string") throw new Error(`argument error`);
            if (typeof (input.pk) !== "number") throw new Error(`argument error`);

            switch (input.tableName.toLowerCase()) {
                case 'eventsegmentuserresponse':
                    {
                        const esur = await db.eventSegmentUserResponse.findFirst({ where: { id: input.pk, } });
                        if (!esur) break;
                        const es = await db.eventSegment.findFirst({ where: { id: esur.eventSegmentId } });
                        if (!es) break;
                        return {
                            eventId: es.eventId
                        };
                    }
                case 'eventuserresponse':
                    {
                        const eur = await db.eventUserResponse.findFirst({ where: { id: input.pk } });
                        if (!eur) break;
                        return {
                            eventId: eur.eventId,
                        }
                    }
                case 'file':
                    {
                        const file = await db.file.findFirst({
                            where: { id: input.pk },
                            select: {
                                publicId: true,
                                fileLeafName: true,
                                taggedEvents: { select: { eventId: true } },
                                taggedInstruments: {
                                    select: { instrument: { select: { publicId: true } } },
                                },
                                taggedSongs: { select: { songId: true } },
                                taggedUsers: { select: { user: { select: { publicId: true } } } },
                            }
                        });
                        if (!file) break;
                        return {
                            eventIds: file.taggedEvents.map(e => e.eventId),
                            instrumentIds: file.taggedInstruments.map(e => e.instrument.publicId),
                            songIds: file.taggedSongs.map(e => e.songId),
                            userIds: file.taggedUsers.map(e => e.user.publicId),
                            file: { publicId: file.publicId, fileLeafName: file.fileLeafName },
                        };
                    }
            }
            return {
            };

        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



