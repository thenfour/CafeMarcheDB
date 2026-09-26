import { resolver, type CMCtx } from "@/src/auth/server/cmResolver";
import db, { Prisma } from "db";
import { z } from "zod";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import { resolvePublicId } from "../server/db3PublicIds";
import { CallMutateEventHooks } from "../server/db3mutationCore";

const ZArgs = z.object({ eventSegmentId: db3.xEventSegment.identitySchema }).strict();

export default resolver.pipe(
    resolver.cmauthorize(Permission.admin_events),
    resolver.zod(ZArgs),
    async (args, ctx: CMCtx) => {

        await db.$transaction(async tx => {
            const eventSegmentId = await resolvePublicId(db3.xEventSegment, args.eventSegmentId, ctx.auth, tx);
            const segment = await tx.eventSegment.findUniqueOrThrow({
                where: { id: eventSegmentId },
                select: { eventId: true }
            });

            const oldValues = await tx.eventSegmentUserResponse.findMany({ where: { eventSegmentId } });
            if (oldValues.length === 0) {
                return;
            }
            await tx.eventSegmentUserResponse.deleteMany({
                where: { eventSegmentId }
            });
            await CallMutateEventHooks({ tableNameOrSpecialMutationKey: "mutation:cleareventsegmentresponses", model: { id: segment.eventId }, db: tx });
            await RegisterChange({
                action: ChangeAction.delete,
                changeContext: CreateChangeContext("clearEventSegmentResponses"),
                table: db3.xEventSegmentUserResponse.tableName,
                pkid: eventSegmentId,
                // Historical Change values retain natural foreign keys.
                oldValues: oldValues.filter(row => row.attendanceId !== null)
                    .map(row => ({ userId: row.userId, attendanceId: row.attendanceId })),
                newValues: undefined,
                ctx,
                db: tx,
            });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        return null;
    },
);
