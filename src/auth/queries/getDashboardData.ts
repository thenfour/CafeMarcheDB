import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { Stopwatch } from "shared/rootroot";

export default resolver.pipe(
    async (args, ctx: AuthenticatedCtx) => {
        try {
            const sw = new Stopwatch();

            const results = await Promise.all([
                db.userTag.findMany(),
                db.permission.findMany(),
                db.role.findMany(),
                db.rolePermission.findMany(),
                db.eventType.findMany(),
                db.eventStatus.findMany(),
                db.eventTag.findMany(),
                db.eventAttendance.findMany(),
                db.fileTag.findMany(),
                db.instrument.findMany(),
                db.instrumentTag.findMany(),
                db.instrumentFunctionalGroup.findMany(),
                db.songTag.findMany(),
                db.songCreditType.findMany()
            ]);

            const [
                userTag,
                permission,
                role,
                rolePermission,
                eventType,
                eventStatus,
                eventTag,
                eventAttendance,
                fileTag,
                instrument,
                instrumentTag,
                instrumentFunctionalGroup,
                songTag,
                songCreditType
            ] = results;

            const ret = {
                userTag,
                permission,
                role,
                rolePermission,
                eventType,
                eventStatus,
                eventTag,
                eventAttendance,
                fileTag,
                instrument,
                instrumentTag,
                instrumentFunctionalGroup,
                songTag,
                songCreditType,
            };

            if (process.env.NODE_ENV === "development") {
                sw.loghelper("total", ret);
            }
            return ret;
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



