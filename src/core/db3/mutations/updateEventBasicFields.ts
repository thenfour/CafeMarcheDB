// updateEventBasicFields
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { TupdateEventBasicFieldsArgs } from "../shared/apiTypes";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (args: TupdateEventBasicFieldsArgs, ctx: AuthenticatedCtx) => {

        // verbose on purpose in order to validate args type against UncheckedUpdateInput
        const fields: Prisma.EventUncheckedUpdateInput = {
            name: args.name,
            slug: args.slug,
            description: args.description,
            typeId: args.typeId,
            visiblePermissionId: args.visiblePermissionId,
            locationDescription: args.locationDescription,
            locationURL: args.locationURL,
            isDeleted: args.isDeleted,
            statusId: args.statusId,
            expectedAttendanceUserTagId: args.expectedAttendanceUserTagId,
            createdByUserId: args.createdByUserId, // TODO: validate client info

            frontpageVisible: args.frontpageVisible,
            frontpageDate: args.frontpageDate,
            frontpageTime: args.frontpageTime,
            frontpageTitle: args.frontpageTitle,
            frontpageDetails: args.frontpageDetails,
            frontpageLocation: args.frontpageLocation,
            frontpageLocationURI: args.frontpageLocationURI,
            frontpageTags: args.frontpageTags,
        };

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        const clientIntention: db3.xTableClientUsageContext = {
            intention: "user",
            mode: "primary",
            currentUser,
        };
        await mutationCore.updateImpl(db3.xEvent, args.eventId, fields, ctx, clientIntention);

        return args;
    }
);

