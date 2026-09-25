import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx, AuthorizationError } from "blitz";
import db, { Prisma } from "db";
import { z } from "zod";
import { getRequestAuthorization } from "@/src/auth/server/requestAuthorization";
import { Permission } from "shared/permissions";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";
import * as db3 from "../db3";
import { db3Server } from "../server/db3Server";
import { resolvePublicIds } from "../server/db3PublicIds";
import { CallMutateEventHooks } from "../server/db3mutationCore";

const ZArgs = z.object({
    fromEventSegmentId: db3.xEventSegment.identitySchema,
    toEventSegmentId: db3.xEventSegment.identitySchema,
}).strict().refine(args => args.fromEventSegmentId !== args.toEventSegmentId, "Choose two different segments.");

// Historical Change values deliberately retain natural foreign keys.
const auditResponses = (rows: Prisma.EventSegmentUserResponseGetPayload<{}>[]) => rows
    .filter(row => row.attendanceId !== null)
    .map(row => ({
        attendanceId: row.attendanceId,
        userId: row.userId,
    }));

export default resolver.pipe(
    resolver.authorize(Permission.admin_events),
    resolver.zod(ZArgs),
    async (args, ctx: AuthenticatedCtx) => {
        const authorization = await getRequestAuthorization(ctx.session);
        const publicData = db3.createDB3Authorization(authorization.user, authorization.effectivePermissions);
        await db.$transaction(async tx => {
            const [fromId, toId] = await resolvePublicIds(db3.xEventSegment,
                [args.fromEventSegmentId, args.toEventSegmentId],
                publicData,
                tx);
            const segments = await tx.eventSegment.findMany({
                where: { id: { in: [fromId!, toId!] } },
                select: { id: true, eventId: true }
            });
            const source = segments.find(segment => segment.id === fromId)!;
            const target = segments.find(segment => segment.id === toId)!;
            if (source.eventId !== target.eventId) {
                throw new Error("Segments must belong to the same event.");
            }
            const sourceValues = await tx.eventSegmentUserResponse.findMany({
                where: { eventSegmentId: fromId }
            });
            const oldValues = await tx.eventSegmentUserResponse.findMany({
                where: { eventSegmentId: toId }
            });
            await tx.eventSegmentUserResponse.deleteMany({
                where: { eventSegmentId: toId }
            });
            for (const row of sourceValues) {
                await db3Server.table(db3.xEventSegmentUserResponse).createWithPublicId(publicId =>
                    tx.eventSegmentUserResponse.create({
                        data: {
                            publicId,
                            eventSegmentId: toId!,
                            userId: row.userId,
                            attendanceId: row.attendanceId,
                        }
                    }));
            }
            await CallMutateEventHooks({
                tableNameOrSpecialMutationKey: "mutation:copyEventSegmentResponses",
                model: { id: target.eventId },
                db: tx
            });
            await RegisterChange({
                action: ChangeAction.update,
                changeContext: CreateChangeContext("copyEventSegmentResponses"),
                table: db3.xEventSegmentUserResponse.tableName,
                pkid: toId!,
                oldValues: auditResponses(oldValues),
                newValues: auditResponses(sourceValues),
                ctx,
                db: tx,
            });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        return null;
    },
);
